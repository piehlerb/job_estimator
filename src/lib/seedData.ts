/**
 * Default seed data for offline/demo mode.
 * Loaded once when a new user enters offline mode with an empty database.
 * IDs are kept stable so chip blend → system references remain valid.
 */

import { ChipSystem, Costs, Laborer, BaseCoatColor, ChipBlend } from '../types';
import {
  getAllSystems,
  addSystem,
  getCosts,
  saveCosts,
  getPricing,
  savePricing,
  getAllLaborers,
  addLaborer,
  getAllChipBlends,
  addChipBlend,
  addBaseCoatColor,
  setAutoSync,
  getDefaultPricing,
} from './db';

const NOW = '2026-04-01T00:00:00.000Z';

// ── Base Coat Colors ──────────────────────────────────────────────────────────

const SEED_BASE_COAT_COLORS: BaseCoatColor[] = [
  { id: 'fblphl4khzbo8mc2xed4va', name: 'Grey',  createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'dbv6nt4olee3yj7tdd6qnf', name: 'Tan',   createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '244nqxa62if3326yqv9voy', name: 'Clear',  createdAt: NOW, updatedAt: NOW, deleted: false },
];

// ── Chip Systems ──────────────────────────────────────────────────────────────

const SEED_SYSTEMS: ChipSystem[] = [
  {
    id: 'e1dkd3bxlujfbuy570062a',
    name: '1/4',
    feetPerLb: 5,
    boxCost: 93,
    baseSpread: 300,
    topSpread: 140,
    cyclo1Spread: 400,
    baseCoats: 1,
    topCoats: 1,
    cyclo1Coats: 0,
    verticalPricePerSqft: 12,
    floorPriceMin: 6.5,
    floorPriceMax: 9,
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: '9mtbkjkyfjgkpdk12c9368',
    name: '1/8',
    feetPerLb: 4.5,
    boxCost: 103,
    baseSpread: 300,
    topSpread: 130,
    cyclo1Spread: 450,
    baseCoats: 1,
    topCoats: 1,
    cyclo1Coats: 0,
    verticalPricePerSqft: 14,
    floorPriceMin: 7,
    floorPriceMax: 9.5,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: 'c79h9zlyz3am2slqbn2gnf',
    name: '1/16',
    feetPerLb: 3.5,
    boxCost: 103,
    baseSpread: 300,
    topSpread: 100,
    cyclo1Spread: 450,
    baseCoats: 1,
    topCoats: 1,
    cyclo1Coats: 0,
    verticalPricePerSqft: 15,
    floorPriceMin: 8,
    floorPriceMax: 11,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: '2cl0w5ka2sbfb60n06ym54',
    name: 'Stone',
    feetPerLb: 200,
    boxCost: 93,
    baseSpread: 300,
    topSpread: 140,
    cyclo1Spread: 450,
    baseCoats: 1,
    topCoats: 2,
    cyclo1Coats: 0,
    verticalPricePerSqft: 12,
    floorPriceMin: 7,
    floorPriceMax: 11,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: 'f5p787qmqsrcg5w0tui7je',
    name: 'Hybrid',
    feetPerLb: 5,
    boxCost: 125,
    baseSpread: 300,
    topSpread: 140,
    cyclo1Spread: 450,
    baseCoats: 1,
    topCoats: 1,
    cyclo1Coats: 0,
    verticalPricePerSqft: 13,
    floorPriceMin: 7,
    floorPriceMax: 12,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: 'mri9gwpnd7qw44qogkge3',
    name: 'Stonebridge',
    feetPerLb: 200,
    boxCost: 125,
    baseSpread: 300,
    topSpread: 140,
    cyclo1Spread: 450,
    baseCoats: 1,
    topCoats: 1,
    cyclo1Coats: 0,
    verticalPricePerSqft: 15,
    floorPriceMin: 7,
    floorPriceMax: 12,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: 'rsqgjlghfrscjsguxx49x',
    name: 'Solid Color',
    feetPerLb: 0,
    boxCost: 0,
    baseSpread: 300,
    topSpread: 0,
    cyclo1Spread: 400,
    baseCoats: 1,
    topCoats: 0,
    cyclo1Coats: 2,
    verticalPricePerSqft: 12,
    floorPriceMin: 6,
    floorPriceMax: 10,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
  {
    id: '4oqbumeq0sg1pffcp3jihy',
    name: 'Grind & Seal',
    feetPerLb: 0,
    boxCost: 0,
    baseSpread: 0,
    topSpread: 0,
    cyclo1Spread: 400,
    baseCoats: 0,
    topCoats: 0,
    cyclo1Coats: 3,
    verticalPricePerSqft: 99,
    floorPriceMin: 8,
    floorPriceMax: 12,
    notes: 'Two coats of cyclo1, no topcoat. Assumes 300 ft/gal first coat and 400 ft/gal second.',
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
  },
];

// ── Costs ─────────────────────────────────────────────────────────────────────

const SEED_COSTS: Costs = {
  id: 'current',
  baseCostPerGal: 120,
  topCostPerGal: 90,
  crackFillCost: 375,
  gasCost: 3.75,
  consumablesCost: 75,
  cyclo1CostPerGal: 140,
  tintCostPerQuart: 115,
  antiSlipCostPerGal: 15,
  abrasionResistanceCostPerGal: 15,
  moistureMitigationCostPerGal: 130,
  moistureMitigationSpreadRate: 100,
  createdAt: NOW,
  updatedAt: NOW,
};

// ── Laborers ──────────────────────────────────────────────────────────────────

const SEED_LABORERS: Laborer[] = [
  { id: 'seed-laborer-1', name: 'Crew Lead',    fullyLoadedRate: 34, isActive: true,  createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'seed-laborer-2', name: 'Installer',    fullyLoadedRate: 30, isActive: true,  createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'seed-laborer-3', name: 'Assistant',    fullyLoadedRate: 28, isActive: true,  createdAt: NOW, updatedAt: NOW, deleted: false },
];

// ── Chip Blends ───────────────────────────────────────────────────────────────

const SEED_CHIP_BLENDS: ChipBlend[] = [
  { id: '031t9okuagknuu8htmzunw', name: 'Camel',          systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '06d3pypw47z27bl6ldw9c',  name: 'Basalt',         systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '093zfmraszm95krke6rj3a5',name: 'Galesville',     systemIds: ['e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '10rd4us8apoqmxg730o3y9p',name: 'Garnet',         systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '16wf6kstbkrzxptvvix2m',  name: 'Bethpage',       systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '1x9a754ftier92cu8faw5',  name: 'Everest',        systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '24o4iwulot2h2jmjj49qor', name: 'Wombat',         systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '2ngn7u47kp8xbh7k6ay5q',  name: 'Pinehurst',      systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '399x5css30hxh4dm5nkd4',  name: 'Garage Force',   systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '3xt9ri1eumls6kcl0c3pio', name: 'Carbon',         systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '4nfet5cesptzo4y0ocjjsj', name: 'Shoreline',      systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '4zfgok12sj80zv7igpzirs', name: 'Desert Storm',   systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '6jmkma3qfaps8x0ecvun6',  name: 'Saddle Tan',     systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '6kyl8se8lbnwsywvlp3rs',  name: 'Coldwater Canyon',systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '7mc28bnp1oga2qqh48zokb', name: 'Tidal Wave',     systemIds: ['e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '7w9v4h63t0frzn674x3vu',  name: 'Dakota Trail',   systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va','dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '8294mbfj6jhx0sir5ykrwi', name: 'Copperplate',    systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va','dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '8e5cmxiqeu2s0jifzorwpl', name: 'Port Rush',      systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: '8iof960g6zufx35oq0kx8',  name: 'Denali',         systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'al3yyo4un8lr1xnri5s9o',  name: 'Raven',          systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'b4wbw4do3hkji17sps81y',  name: 'Pumice',         systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'bbweldqar6cuvn2kshjpo',  name: 'Lighthouse',     systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'bc2oizhpr5ksfqz44l62u',  name: 'Woodland',       systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'btkk8jn4bchkrr3ea0i1k',  name: 'Willow',         systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'cdpckyou4qlfatokkrxb6f', name: 'Cabin Fever',    systemIds: ['9mtbkjkyfjgkpdk12c9368','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'd86srrn6bdrcjvpeemzvw8',  name: 'Birch Bark',     systemIds: ['e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'dsklcpdt4gqpwnaugnoan',  name: 'Harvest',        systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'e9u527u2c5b9eaith5cjk',  name: 'Cobblestone',    systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'ec662bodsspy6l8i1b12wo', name: 'Victorian',      systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'gikp93x07cnbdshreu9brr', name: 'Gunflint Trail', systemIds: ['e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'hvn9bhpqudquvlsoz4hzin', name: 'Blue Granite',   systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'iignvz8sh38spbu96e4lcb', name: 'Buckskin',       systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'iijhftvemye8eet5boffwb', name: 'Grizzly',        systemIds: ['e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'iwc3dir5018l67vrqioecl', name: 'Troon',          systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'ja4muyvin6b8oyeiaqkasb', name: 'Nightfall',      systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'kk264uc4xmb4pej3f77zew', name: 'Sagebrush',      systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'l1xctl11mqghpx9mrhrlg7', name: 'Agate',          systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'l982ulm2sj8ls59w98klsm', name: 'Denim',          systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'mqtjoe1382cn59pfoxgaz',  name: 'Blue Blend',     systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'mrwr5oj912gir1vnbargx',  name: 'Portobello',     systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'n5usceonh78fjvwelyslif', name: 'Tan',            systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'os4f7yrufvhiss5gf3rjek', name: 'Santa Fe',       systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'oujsl1d2d9n9bnil5kxnp',  name: 'Creekbed',       systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'p9xybe9wlwpg86ytq50pw9', name: 'Himalayan',      systemIds: ['e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'pl1h4wnwaffj91x6txyff',  name: 'Autumn',         systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'qecc5te38qqemkgcz7431a', name: 'Rocky Point',    systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'qqwgqqf3sqkv2qu47f31bj', name: 'Bakersville',    systemIds: ['mri9gwpnd7qw44qogkge3'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'qxfuyuqtg693n0wsdmpm',   name: 'Dolerite',       systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'rg4eogpt65mufs410hgedn', name: 'Limestone',      systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'rom89foblhajkl1uyvhti',  name: 'Gravel',         systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 's5sanxchv8q27f600hl0v8', name: 'Northwoods',     systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'sdz6rnoucdo8axoiwams',   name: 'Mocha',          systemIds: [], baseCoatColorIds: [], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'tsgvash2u4ftl2puiw6x6',  name: 'Domino',         systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'tuu49nuf24i4dsyamlh18z', name: 'Phoenix',        systemIds: ['f5p787qmqsrcg5w0tui7je'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'tzxo4jmzkj0xf377degx3a', name: 'Birch',          systemIds: [], baseCoatColorIds: [], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'u40fskfcz7oc32n7lttus',  name: 'Feldspar',       systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'upqiypvmp1vz68olf9yn9',  name: 'Zen Green',      systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'vhxcjubc6wp8q28rjtyi8v', name: 'Dolphin',        systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va','dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'w94s1020m2df32huo14cq6', name: 'Burlap',         systemIds: ['c79h9zlyz3am2slqbn2gnf','e1dkd3bxlujfbuy570062a','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'xozneatqkw80bvo2hwijixt',name: 'Terrazzo',       systemIds: ['9mtbkjkyfjgkpdk12c9368','e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf'], baseCoatColorIds: ['fblphl4khzbo8mc2xed4va','dbv6nt4olee3yj7tdd6qnf'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'xvcocxwom9odcxyxk5a9m',  name: 'CUSTOM',         systemIds: ['e1dkd3bxlujfbuy570062a','c79h9zlyz3am2slqbn2gnf','9mtbkjkyfjgkpdk12c9368'], baseCoatColorIds: ['244nqxa62if3326yqv9voy','dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'yzooe2e2hebubot950pnyn', name: 'Obsidian',       systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['dbv6nt4olee3yj7tdd6qnf','fblphl4khzbo8mc2xed4va'], createdAt: NOW, updatedAt: NOW, deleted: false },
  { id: 'zegw51rputdts76ingvv',   name: 'Schist',         systemIds: ['2cl0w5ka2sbfb60n06ym54'], baseCoatColorIds: ['244nqxa62if3326yqv9voy'], createdAt: NOW, updatedAt: NOW, deleted: false },
];

// ── Seed function ─────────────────────────────────────────────────────────────

/**
 * Seeds the local IndexedDB with default data for offline/demo use.
 * Only runs if the systems store is empty — safe to call on every startup.
 */
export async function seedOfflineData(): Promise<void> {
  const existingSystems = await getAllSystems();
  if (existingSystems.length > 0) return; // Already configured — skip

  console.log('[Seed] Seeding default data for offline mode...');

  // Disable sync so we don't queue 100+ fake sync operations
  setAutoSync(false);

  try {
    // Base coat colors first (blends reference these)
    for (const color of SEED_BASE_COAT_COLORS) {
      await addBaseCoatColor(color);
    }

    // Systems (blends reference these)
    for (const system of SEED_SYSTEMS) {
      await addSystem(system);
    }

    // Costs (only if not already set)
    const existingCosts = await getCosts();
    if (!existingCosts) {
      await saveCosts(SEED_COSTS);
    }

    // Pricing (only if not already set)
    const existingPricing = await getPricing();
    if (!existingPricing) {
      await savePricing(getDefaultPricing());
    }

    // Laborers
    const existingLaborers = await getAllLaborers();
    if (existingLaborers.length === 0) {
      for (const laborer of SEED_LABORERS) {
        await addLaborer(laborer);
      }
    }

    // Chip blends last (depend on systems + colors)
    const existingBlends = await getAllChipBlends();
    if (existingBlends.length === 0) {
      for (const blend of SEED_CHIP_BLENDS) {
        await addChipBlend(blend);
      }
    }

    console.log('[Seed] Default data seeded successfully.');
  } finally {
    setAutoSync(true);
  }
}
