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
  constructor(properties) 
  { 
    for (let property in properties) 
    {
      this[property] = properties[property]; 

      this.inputs = { byDistance: {} };
      this.callbacks = [];
    }
  }
}

class Data
{
  constructor(data)
  {
    // set up the tier definitions
    this.tiers = { };

    // associate and index the tiers
    for (let tierData of data.tiers)
    {
      let tier = new Tier(tierData);
      this.tiers[tier.name] = tier;
    }

    // associate and index the commodities
    this.commodities = { byTier: {} };

    for (let commodityData of data.commodities)
    {
      let commodity = new Commodity(commodityData);

      // Index commodities by name
      this.commodities[commodity.name] = commodity;

      // this looks weird but basically just sets a bi-directional reference
      // between a particular commodity and the tier it is in
      commodity.tier = this.tiers[commodity.tierName];
      commodity.tier.commodities.push(commodity);

      // This indexes commodities by tier
      if (this.commodities.byTier[commodity.tier] == null) 
        { this.commodities.byTier[commodity.tier] = [commodity]; }
      else
        { this.commodities.byTier[commodity.tier].push(commodity); }

      commodity.buyPrice = commodity.tier.baseValue;
      commodity.sellPrice = commodity.tier.baseValue;
    }

    // This loops through and adds inputs for the commodity.
    for (let commodity of Object.values(this.commodities))
      { if (commodity.inputNames != null) getInputs(this, commodity, commodity); }
  }
}

// recursively build up the inputs 
function getInputs(data, grandcommodity, commodity, distance = 0, neededPerInput = 1)
{
  let newInputs = commodity.inputNames.map(inputName => data.commodities[inputName]);
  if (grandcommodity.inputs.byDistance[distance] == undefined)
    { grandcommodity.inputs.byDistance[distance] = { cost: 0, commodities: {}}; }
  let inpByD = grandcommodity.inputs.byDistance[distance];

  for (let inp of newInputs)
  { 
    let tuple = inpByD.commodities[inp.name] == undefined ?
      { input: inp, quantity: 0 } : 
      inpByD.commodities[inp.name];

    tuple.quantity += neededPerInput * inp.tier.neededAsInput;
    inpByD.commodities[inp.name] = tuple;

    if (inp.inputNames != null) 
      { getInputs(data, grandcommodity, inp, distance + 1, tuple.quantity /inp.tier.producedPerCycle ); }
  }
}

function calculateCosts(commodity)
{
  let distances = commodity.inputs.byDistance;
  for (let distance in distances)
  {
    let dist = distances[distance];
    dist.cost = 0;
    for (let cmdt in dist.commodities)
    {
      let commodity = dist.commodities[cmdt];
      dist.cost += commodity.input.buyPrice * commodity.quantity;
    }
  }
}

function setup() 
{
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
      enclosingDiv.setAttribute('id', cmdt.name);
      enclosingDiv.innerHTML = cmdt.name + ": ";
      document.getElementsByTagName('body')[0].appendChild(enclosingDiv);

      // price paid for good
      var price = document.createElement('input');
      price.setAttribute('id', cmdt.name + '_price');
      price.setAttribute('type', 'number');
      price.setAttribute('value', baseValue);
      price.setAttribute('onchange', "updateCommodity('" + cmdt.name + "');");
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

      if (cmdt.inputs.byDistance[0]) { showInputs(enclosingDiv, cmdt, cmdt.name); }
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
  for (let inpTuple of Object.values(cmdt.inputs.byDistance[0].commodities))
  {
    let inp = inpTuple.input;
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

    distanceElem.cost.total += inp.buyPrice * (neededPerInput * inp.tier.neededAsInput);
    inputElem.needed += neededPerInput * inp.tier.neededAsInput;
    inputElem.totalPrice = inp.buyPrice * inputElem.needed;

    inputElem.innerText = " | " + inputElem.needed + " " + inp.name + " :: " + inputElem.totalPrice + " isk";

    if (inp.inputs.byDistance[0]) 
      { showInputs(div, inp, parentName, inputElem.needed/inp.tier.producedPerCycle, recursionLevel + 1); }
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

function updateCommodity(item)
{
    var itemPrice = parseFloat(document.getElementById(item + "_price").value);
    var basePrice = parseFloat(document.getElementById(item + "_base_price").innerText);
    var totalPrice = getTax(item, itemPrice, basePrice, true);

    document.getElementById(item + "_total_price").innerText = " " + totalPrice;

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

