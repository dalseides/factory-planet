// this is essentially the 'view' logic for this webapp.
// 'setup()' drives the generation of HTML
function setup() 
{
  const parentDiv = document.createElement('div');
  parentDiv.setAttribute('id', 'contents');
  document.getElementsByTagName('body')[0].appendChild(parentDiv);

  // set up tax div
  const taxDiv = document.createElement('div');
  taxDiv.innerText = 'Tax rate: ';
  const taxInput = document.createElement('input');
  taxInput.setAttribute('id', 'tax_rate');
  taxInput.setAttribute('type', 'number');
  taxInput.setAttribute('value', window.data.tax);
  taxInput.setAttribute('onchange', "updateWithNewTax(this.value);");
  taxDiv.appendChild(taxInput);
  parentDiv.appendChild(taxDiv);
  window.data.revealedCommodities = [];
  
  // set up each of the tiers of commodities
  tiers = window.data.tiers;
  for (let tierNo of Object.keys(tiers))
  {
    let tier = tiers[tierNo];
    let baseValue = tier.baseValue;
    let tierDiv = document.createElement('div');
    tierDiv.setAttribute('class', 'tier');
    parentDiv.appendChild(tierDiv);

    for (let cmdt of tier.commodities)
    {
      // outer div
      let enclosingDiv = document.createElement('div');
      tierDiv.appendChild(enclosingDiv);
      enclosingDiv.setAttribute('id', cmdt.name.replace(/ /g,'_'));
      enclosingDiv.setAttribute('class', 'card');
      enclosingDiv.setAttribute('commodity', cmdt.name);

      let titleDiv = document.createElement('div');
      titleDiv.setAttribute('class', 'card-title');
      titleDiv.innerHTML = cmdt.name;
      enclosingDiv.appendChild(titleDiv);

      // first-tier items don't *make* profit. Not profit worth speaking of at least.
      if (tierNo > 1)
      {
        let bestProfitDiv = document.createElement('div');
        bestProfitDiv.setAttribute('class', 'best-profit');
        enclosingDiv.appendChild(bestProfitDiv);
        bestProfitDiv.innerText = 'Best Profit: ' + cmdt.bestProfit;
        cmdt.bestProfitDiv = bestProfitDiv;
      }

      // price paid for good
      let price = document.createElement('input');
      price.setAttribute('id', cmdt.name.replace(/ /g,'_') + '_buy_price');
      price.setAttribute('label', 'Buy Price');
      price.setAttribute('type', 'number');
      price.setAttribute('value', baseValue);
      price.setAttribute('commodity', cmdt.name);
      price.setAttribute('onchange', "updateCommodity(this);");
      enclosingDiv.appendChild(price);

      // only tiers after tier 1 have interesting inputs
      if (tierNo > 1)
      {
        // price good is sold for
        price = document.createElement('input');
        price.setAttribute('id', cmdt.name.replace(/ /g,'_') + '_sell_price');
        price.setAttribute('label', 'Sell Price');
        price.setAttribute('type', 'number');
        price.setAttribute('value', baseValue);
        price.setAttribute('commodity', cmdt.name);
        price.setAttribute('onchange', "updateCommoditySellPrice(this);");
        enclosingDiv.appendChild(price);
      }

      if (cmdt.inputs.byDistance[0]) { displayInputs(enclosingDiv, cmdt); }
    }
  }
}

function displayInputs(enclosingDiv, cmdt)
{
  let div = document.createElement('div');
  enclosingDiv.appendChild(div);
  cmdt.detailsDiv = div;
  cmdt.sticky = false;
  div.setAttribute('class', 'card-details');
  div.setAttribute('id', cmdt.name.replace(/ /g,'_') + '-inner');
  div.setAttribute('hidden', '');
  enclosingDiv.setAttribute('onmouseover', "showDetails(this);");
  enclosingDiv.setAttribute('onmouseout', "hideDetails(this);");
  enclosingDiv.setAttribute('onclick', "setSticky(this);");

  // set up div for all inputs of a given distance from the final product
  for (let distance in cmdt.inputs.byDistance)
  {
    let distElem = undefined;
    let dist = cmdt.inputs.byDistance[distance];
    let id = cmdt.name.replace(/ /g,'_') + '_' + distance;
  
    if (!(distElem = document.getElementById(id)))
    {
      distElem = document.createElement('div');
      distElem.setAttribute('id', id);
      let totalCost = document.createElement('div');
      totalCost.setAttribute('id', id + distance + '_price');
      totalCost.innerText = 
        'cost: ' + dist.cost + ' profit: ' + dist.profit;

      // we store the div with the distance for use by callbacks
      dist.div = totalCost;

      distElem.appendChild(totalCost);
      div.appendChild(distElem);
    }

    for (let input in dist.commodities)
    {
      let comm = dist.commodities[input];
      let elemName = id + '-' + comm.input.name.replace(/ /g,'_');
      let inputElem = undefined;

      // if this element already exists, we have nothing to do
      for (let child of distElem.childNodes) { if (child.id == elemName) { inputElem = child } }
      
      // if it *doesn't* exist yet, create it.
      if (!inputElem)
      {
        inputElem = document.createElement('div');
        inputElem.setAttribute('id', elemName);
        distElem.appendChild(inputElem);

        // we store the div with the commodity for ease of use by callbacks
        comm.div = inputElem; 

        inputElem.innerText = 
          comm.quantity + " " 
          + comm.input.name + " :: " 
          + comm.importCost + " isk";
      }
    }
  }
}

function updateCommodity(itemPriceElem)
{
  let item = window.data.commodities[itemPriceElem.getAttribute('commodity')];
  item.buyPrice = itemPriceElem.value;

  // whenever the cost of this item changes, the cost of everything that
  // consumes it also changes
  for (let callback of item.callbacks) { callback(); }
}

function updateCommoditySellPrice(itemPriceElem)
{
  let item = window.data.commodities[itemPriceElem.getAttribute('commodity')];
  item.sellPrice = itemPriceElem.value;

  // whenever the sell price of this item changes, the profitability
  // of building it at each level changes
  calculateCostsByDistance(window.data, item);
}

// the tax system operates off of callbacks; ALL commodities subscribe
// to the tax callbacks system. 
//
// while this feels like we're creating tons of work for the browser to
// do, updating individual elements--whose particular divs we have already
// stored references to--is still a lot less work than the alternative:
// throwing away the whole page and rebuilding it.
function updateWithNewTax(newTax = 0.15)
{
  window.data.tax = newTax;
  for (let callback of window.data.taxCallbacks) { callback(); }
}

function setSticky(itemElem)
{
  let item = window.data.commodities[itemElem.getAttribute('commodity')];
  item.sticky = !item.sticky;
}

function showDetails(itemElem)
  { window.data.commodities[itemElem.getAttribute('commodity')].detailsDiv.removeAttribute('hidden'); }

function hideDetails(itemElem)
{
  let item = window.data.commodities[itemElem.getAttribute('commodity')];
  if (!item.sticky) item.detailsDiv.setAttribute('hidden', '');
}

// this is essentially the 'main' of this webapp
function getData() 
{
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function ()
  {
    if (this.readyState == 4 && this.status == 200)
    {
      // creates a new Data() object from picalc.js
      window.data = new Data(JSON.parse (this.responseText));

      // this is essentially the view logic; it builds the HTML
      setup();
    }
  };

  xmlhttp.open("GET", "https://tspi.io/factory-planet/planetary_commodities.json", true);
  xmlhttp.send();
}

