class Tier
{
  constructor(properties)
  {
    for (let property in properties) this[property] = properties[property];

    this.commodities = [];
  }
}

class Commodity
{
  constructor(properties) { for (let property in properties) this[property] = properties[property]; }
}

class Data
{
  constructor(data)
  {
    // set up the tier definitions
    this.tiers = { byName: {} };

    // associate and index the tiers
    for (let tierData of data.tiers)
    {
      let tier = new Tier(tierData);
      this.tiers.byName[tier.name] = tier;
    }

    // associate and index the commodities
    this.commodities = 
    {
      byName: {},
      byTier: {},
    };

    for (let commodityData of data.commodities)
    {
      let commodity = new Commodity(commodityData);

      // Index commodities by name
      this.commodities.byName[commodity.name] = commodity;

      // this looks weird but basically just sets a bi-directional reference
      // between a particular commodity and the tier it is in
      commodity.tier = this.tiers.byName[commodity.tierName];
      commodity.tier.commodities.push(commodity);

      // This indexes commodities by tier
      if (this.commodities.byTier[commodity.tier] == null) 
        { this.commodities.byTier[commodity.tier] = [commodity]; }
      else
        { this.commodities.byTier[commodity.tier].push(commodity); }

      commodity.sellPrice = commodity.tier.baseValue;
    }

    for (let commodity of Object.values(this.commodities.byName))
    {
      if (commodity.inputNames != null)
      {
        let newInputs = commodity.inputNames.map(inputName => this.commodities.byName[inputName]);
        if (commodity.inputs == null) { commodity.inputs = newInputs; }
        else { commodity.inputs = commodity.inputs.concat(newInputs); }
      }
    }
  }
}

function setup() 
{
  tiers = window.data.tiers;
  commodities = window.data.commodities;
  
  for (let tierNo of Object.keys(tiers.byName))
  {
    var tier = tiers.byName[tierNo];
    var baseValue = tier.baseValue;

    for (let cmdt of tier.commodities)
    {
      // outer div
      var enclosingDiv = document.createElement('div');
      enclosingDiv.setAttribute('id', cmdt.name);
      enclosingDiv.innerHTML = cmdt.name + ": ";
      document.getElementsByTagName('body')[0].appendChild(enclosingDiv);

      // price paid for good
      var price = document.createElement('input');
      price.setAttribute('id', cmdt.name + '_price');
      price.setAttribute('type', 'number');
      price.setAttribute('value', baseValue);
      price.setAttribute('onchange', "printTax('" + cmdt.name + "');");
      enclosingDiv.appendChild(price);

      // 'value' assumed for planetary commodity for tax
      var basePrice = document.createElement("paragraph");
      basePrice.style.display = 'none';
      basePrice.setAttribute('id', cmdt.name + "_base_price");
      basePrice.innerText = baseValue;
      enclosingDiv.appendChild(basePrice);

      // price paid plus tax to import
      var totalPriceElem = document.createElement("paragraph");
      var totalPriceVal = getTax(cmdt.name, baseValue, baseValue, true);
      totalPriceElem.innerText = " " + totalPriceVal;
      totalPriceElem.setAttribute('id', cmdt.name + '_total_price');
      enclosingDiv.appendChild(totalPriceElem);

      if (cmdt.inputs) { showInputs(enclosingDiv, cmdt, cmdt.name); }
    }
  }
}

function showInputs(div, cmdt, parentName, neededPerInput = 1, recursionLevel = 0)
{
  // set up div for all inputs of a given distance from the final product
  let distanceElem = undefined;
  let inputCostPerDistance = undefined;
  if (document.getElementById(parentName + recursionLevel)) 
  {  
    distanceElem = document.getElementById(parentName + recursionLevel);
  }
  else 
  {
    distanceElem = document.getElementById(parentName + recursionLevel);
    distanceElem = document.createElement('div');
    distanceElem.setAttribute('id', parentName + recursionLevel);
    inputCostPerDistance = document.createElement('div');
    inputCostPerDistance.setAttribute('id', parentName + recursionLevel + 'price');
    inputCostPerDistance.total = 0;
    distanceElem.appendChild(inputCostPerDistance);
    distanceElem.cost = inputCostPerDistance;
    div.appendChild(distanceElem);
  }

  // now go through each input, recursively, until we have built up
  // the total inputs for each level
  for (let inp of cmdt.inputs) 
  {
    let elemName = parentName + '-' + inp.name;
    let inputElem = undefined;

    // lets find this node if it exists instead of making new one
    for (let child of distanceElem.childNodes) { if (child.id == elemName) { inputElem = child } }
    
    // and let's create the element if it doesn't exist yet (likely)
    if (!inputElem)
    {
      inputElem = document.createElement('div');
      inputElem.setAttribute('id', elemName);
      inputElem.needed = 0;
      inputElem.totalPrice = 0;
      distanceElem.appendChild(inputElem);
    }

    distanceElem.cost.total += inp.sellPrice * (neededPerInput * inp.tier.neededAsInput);
    inputElem.needed += + neededPerInput * inp.tier.neededAsInput;
    inputElem.totalPrice = inp.sellPrice * inputElem.needed;

    inputElem.innerText = " | " + inputElem.needed + " " + inp.name + " :: " + inputElem.totalPrice + " isk";

    if (inp.inputs) { showInputs(div, inp, parentName, inputElem.needed/inp.tier.producedPerCycle, recursionLevel + 1); }
  }

  distanceElem.cost.innerText = '----- total price at this level: ' + distanceElem.cost.total + ' ---------';
}

function getTax(item, itemPrice, baseValue, is_import) 
{
    var tax = (document.getElementById("tax_rate").value)/100;
    var effectiveTax = is_import ? 0.5 * tax : tax;
    var importCost = baseValue * effectiveTax
    
    var totalPrice = importCost + itemPrice;

    return totalPrice;
}

function printTax(item)
{
    var itemPrice = parseFloat(document.getElementById(item + "_price").value);
    var basePrice = parseFloat(document.getElementById(item + "_base_price").innerText);
    var totalPrice = getTax(item, itemPrice, basePrice, true);

    document.getElementById(item + "_total_price").innerText = " " + totalPrice;
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

  xmlhttp.open("GET", "https://tspi.io/planetary_commodities.json", true);
  xmlhttp.send();
}

