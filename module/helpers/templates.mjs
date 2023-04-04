/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials
    'systems/sombre-classic/templates/actor/parts/actor-features.hbs',
    'systems/sombre-classic/templates/actor/parts/actor-items.hbs',
    'systems/sombre-classic/templates/actor/parts/actor-effects.hbs',
    'systems/sombre-classic/templates/actor/parts/actor-advantage-disadvantage.hbs',
    // Item partials
    'systems/sombre-classic/templates/item/parts/item-trait.hbs',
    'systems/sombre-classic/templates/item/parts/item-personality-level.hbs',
  ]);
};
