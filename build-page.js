function setup() 
{
  // set up tax div
  var taxDiv = document.createElement('div');
  taxDiv.innerText = 'Tax rate: ';
  var taxInput = document.createElement('input');
  taxInput.setAttribute('id', 'tax_rate');
  taxInput.setAttribute('type', 'number');
  taxInput.setAttribute('value', window.data.tax);
  taxDiv.appendChild(taxInput);
  document.getElementsByTagName('body')[0].appendChild(taxDiv);
  
  tiers = window.data.tiers;
  commodities = window.data.commodities;

  for (let tierNo of Object.keys(tiers))
  {
    var tier = tiers[tierNo];
    var baseValue = tier.baseValue;

    for (let cmdt of tier.commodities)
    {
      // outer div
      var enclosingDiv = document.createElement('div');
      enclosingDiv.commodity = cmdt;
      enclosingDiv.setAttribute('id', cmdt.name.replace(/ /g,'_'));
      enclosingDiv.innerHTML = cmdt.name + ": ";
      document.getElementsByTagName('body')[0].appendChild(enclosingDiv);

      // price paid for good
      var price = document.createElement('input');
      price.setAttribute('id', cmdt.name.replace(/ /g,'_') + '_price');
      price.setAttribute('type', 'number');
      price.setAttribute('value', baseValue);
      price.setAttribute('onchange', "updateCommodity('" + cmdt.name + "');");
      cmdt.buyPriceDiv = price;
      enclosingDiv.appendChild(price);

      // price paid plus tax to import
      var totalPriceElem = document.createElement("p");
      var totalPriceVal = getTax(cmdt.name, baseValue, baseValue, true);
      totalPriceElem.innerText = " " + totalPriceVal;
      totalPriceElem.setAttribute('id', cmdt.name.replace(/ /g,'_') + '_total_price');
      cmdt.totalImportCost = totalPriceElem;

      enclosingDiv.appendChild(totalPriceElem);

      if (cmdt.inputs.byDistance[0]) { displayInputs(enclosingDiv, cmdt); }
    }
  }
}

function displayInputs(div, cmdt)
{
  // set up div for all inputs of a given distance from the final product
  for (let distance in cmdt.inputs.byDistance)
  {
    dist = cmdt.inputs.byDistance[distance];
    let distElem = undefined;
    let id = cmdt.name.replace(/ /g,'_') + '_' + distance;
  
    if (document.getElementById(id)) 
    {  
      distElem = document.getElementById(id);
    }
    else 
    {
      distElem = document.createElement('div');
      distElem.setAttribute('id', id);
      totalCost = document.createElement('div');
      totalCost.setAttribute('id', id + distance + '_price');
      totalCost.total = dist.cost;
      totalCost.innerText = '----- total cost at this level: ' + totalCost.total + ' ---------';
      distElem.appendChild(totalCost);
      div.appendChild(distElem);
    }

    for (let input in dist.commodities)
    {
      let comm = dist.commodities[input];
      let elemName = id + '-' + comm.input.name.replace(/ /g,'_');
      let inputElem = undefined;

      // lets find this node if it exists instead of making new one
      for (let child of distElem.childNodes) { if (child.id == elemName) { inputElem = child } }
      
      // and let's create the element if it doesn't exist yet
      if (!inputElem)
      {
        inputElem = document.createElement('div');
        inputElem.setAttribute('id', elemName.replace(/ /g,'_'));
        inputElem.needed = comm.quantity;
        inputElem.totalPrice = comm.importCost;
        distElem.appendChild(inputElem);

        inputElem.innerText = " | " + inputElem.needed + " " + comm.input.name + " :: " + inputElem.totalPrice + " isk";
      }
    }

  }
}

function getTax(item, itemPrice, baseValue, is_import) 
{
  var tax = (document.getElementById("tax_rate").value);
  var effectiveTax = is_import ? 0.5 * tax : tax;
  var importCost = baseValue * effectiveTax
  
  var totalPrice = importCost + itemPrice;

  return totalPrice;
}

function updateCommodity(itemName)
{
  let item = window.data.commodities[itemName];
  var itemPrice = parseFloat(item.buyPriceDiv.value);
  var basePrice = item.tier.baseValue;
  var totalPrice = getTax(item, itemPrice, basePrice, true);

  item.totalImportCost.innerText = " " + totalPrice;

  for (let callb of item.callbacks)
  {
    console.log('calling back on ' + callb);
  }
}

function getData() 
{
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function ()
  {
    if (this.readyState == 4 && this.status == 200)
    {
      window.data = new Data(JSON.parse (this.responseText));
      setup();
    }
  };

  xmlhttp.open("GET", "https://tspi.io/factory-planet/planetary_commodities.json", true);
  xmlhttp.send();
}

