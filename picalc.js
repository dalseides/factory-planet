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
    this.tax = data.tax;
    this.taxCallbacks = [];
    this.tiers = {};

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
    { 
      if (commodity.inputNames != null) 
      {
        setupInputs(this, commodity, commodity); 

        // is there a way to do this without the verbose lambda declaration?
        this.taxCallbacks.push( function() { setupInputs(window.data, commodity, commodity, 0, 0); });
      }
    }
  }
}

// recursively build up the inputs 
function setupInputs(data, grandcommodity, commodity, distance = 0, neededPerInput = 1)
{
  let newInputs = commodity.inputNames.map(inputName => data.commodities[inputName]);
  if (grandcommodity.inputs.byDistance[distance] == undefined)
    { grandcommodity.inputs.byDistance[distance] = { cost: 0, commodities: {}}; }
  let inpByD = grandcommodity.inputs.byDistance[distance];

  // now go through each input, recursively, until we have built up
  // the total inputs for each level
  for (let inp of newInputs)
  { 
    let tuple = undefined;
    if (inpByD.commodities[inp.name] == undefined)
    {
      tuple = { input: inp, quantity: 0, importCost: 0 };
    }
    else
    {
      tuple = inpByD.commodities[inp.name];
    }

    // figure out how many of these we need
    tuple.quantity += neededPerInput * inp.tier.neededAsInput;

    tuple = calculateInputCost(data, tuple);
    inpByD.commodities[inp.name] = tuple;

    // also whenever the input price changes we should probably
    // do something about that
    inp.callbacks.push
      (
        function()
        {
          calculateInputCost(data, tuple);
          calculateCostsByDistance(data, grandcommodity);
        }
      );

    if (inp.inputNames != null) 
      { setupInputs(data, grandcommodity, inp, distance + 1, tuple.quantity /inp.tier.producedPerCycle ); }
  }

  calculateCostsByDistance(data, grandcommodity);
}

function calculateInputCost(data, tuple)
{
  let inp = tuple.input;
  tuple.importCost = tuple.quantity * inp.buyPrice;
  tuple.importCost += data.tax * tuple.quantity * inp.tier.baseValue / 2;

  if (tuple.div) 
  { 
    tuple.div.innerText = 
      " | " + tuple.quantity + " " 
      + inp.name + " :: " 
      + tuple.importCost + " isk"; 
  }

  return tuple;
}

function calculateCostsByDistance(data, commodity)
{
  let distances = commodity.inputs.byDistance;
  let exportTax = commodity.tier.baseValue * data.tax;
  for (let distance in distances)
  {
    let dist = distances[distance];
    dist.cost = exportTax;
    for (let cmdt in dist.commodities)
    {
      let commodity = dist.commodities[cmdt];
      dist.cost += commodity.importCost;
    }

    if (dist.div) 
    { 
      dist.div.innerText = '----- cost: ' + dist.cost + ' profit: ' 
        + (commodity.sellPrice - (dist.cost / commodity.tier.producedPerCycle)) + ' ---------';
    }
  }
}

