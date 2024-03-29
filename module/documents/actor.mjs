import { ADRENALINE_VALUES } from '../helpers/constants.js';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SombreActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.sombreClassic || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  getPersonalityLevel() {
    const mindValue = this.system.mind.value;

    if (8 < mindValue) {
      return 1;
    }

    if (4 < mindValue) {
      return 2;
    }

    return 3;
  }

  isUnderAdrenaline() {
    for (const value of ADRENALINE_VALUES) {
      const adrenaline = this.system.adrenaline[value];

      if (adrenaline && adrenaline.activated && !adrenaline.used) {
        return true;
      }
    }

    return false;
  }

  spendAdrenaline() {
    for (const value of ADRENALINE_VALUES) {
      const adrenaline = this.system.adrenaline[value];

      if (adrenaline && adrenaline.activated && !adrenaline.used) {
        this.update({ [`system.adrenaline.${value}.used`]: true });
      }
    }
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character') return;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;
  }

  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    this._onBodyPreUpdate(changed);
  }

  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);

    if (game.user.id !== userId) {
      return;
    }

    if (data.system?.mind?.value) {
      this._onMindUpdate();
    }
  }

  _onBodyPreUpdate(changed) {
    if (!changed.system?.body) {
      return;
    }

    for (const value of ADRENALINE_VALUES) {
      foundry.utils.setProperty(changed, `system.adrenaline.${value}.unlock`, changed.system.body.value <= value);
    }
  }

  _onMindUpdate() {
    if (!this.system.personality) {
      return;
    }

    const item = this.items.get(this.system.personality);
    if (!item) {
      return;
    }

    const level = this.getPersonalityLevel();

    item.update({
      'name': item.system.levels[`lvl${level}`].name,
      'system.current': `lvl${level}`,
    });
  }
}
