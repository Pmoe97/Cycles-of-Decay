/* dev/data/npc/equipmentPools.js */
window.setup = window.setup || {};
setup.data = setup.data || {};
setup.data.equipmentPools = setup.data.equipmentPools || {
  clothing_body: ["itm_paramedic_vest","itm_worn_jacket", null],
  clothing_hands:["itm_work_gloves", null],
  mainHand: ["itm_rescue_shears","itm_pocket_knife", null],
  pack: [
    {"id":"itm_bandage","qty":[1,5]},
    {"id":"itm_painkiller_tabs","qty":[1,3]},
    {"id":"itm_water_bottle","qty":[1,1]},
    {"id":"itm_energy_bar","qty":[1,4]},
    {"id":"itm_flashlight","qty":[1,1], "durability":0.6}
  ]
};
