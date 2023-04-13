import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class SombreActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['sombre-classic', 'sheet', 'actor'],
      template: 'systems/sombre-classic/templates/actor/actor-sheet.hbs',
      width: 600,
      height: 600,
    });
  }

  /** @override */
  get template() {
    return `systems/sombre-classic/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if ('character' === actorData.type) {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if ('npc' === actorData.type) {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    const mindLabels = {
      12: '__Équilibré',
      8: '__Perturbé',
      4: '__Désaxé',
      0: '__Fou',
    };
    const bodyLabels = {
      12: '__Indemne',
      8: '__Blessé',
      4: '__Mutilé',
      0: '__Mort',
    };

    context.mind_gauge = [];
    context.body_gauge = [];

    for (let i = 12; i >= 0; i--) {
      const mindLabel = mindLabels[i] ?? null;
      const bodyLabel = bodyLabels[i] ?? null;

      context.mind_gauge.push({
        add_checkbox: 12 !== i,
        label: mindLabel,
        threshold: null !== mindLabel,
        value: i,
        checked: context.system.mind.value <= i,
      });

      const gaugeData = {
        add_checkbox: 12 !== i,
        label: bodyLabel,
        threshold: null !== bodyLabel,
        value: i,
        checked: context.system.body.value <= i,
      };

      this._addAdrenalineData(i, gaugeData);

      context.body_gauge.push(gaugeData);
    }

    context.advantage = this.actor.items.find(i => 'advantage' === i.type);
    context.disadvantage = this.actor.items.find(i => 'disadvantage' === i.type);
    context.personality = this.actor.items.find(i => 'personality' === i.type);
  }

  _addAdrenalineData(level, gaugeData) {
    if (!this.actor.system.adrenaline[level]) {
      return;
    }

    gaugeData.adrenaline = this.actor.system.adrenaline[level];
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    html[0].querySelectorAll('.js-gauge').forEach(el => el.addEventListener('input', e => {
      const target = e.currentTarget;
      const gaugeItems = html[0].querySelectorAll(`[data-type="${target.dataset.type}"]`);
      let targetValue = parseInt(target.value, 10);

      // If unchecked, add one to set previous value
      if (!target.checked) {
        ++targetValue;
      }

      gaugeItems.forEach(item => {
        if (item !== target) {
          item.checked = parseInt(item.value, 10) > targetValue;
        }
      });

      this.actor.update({
        [`system.${target.dataset.type}.value`]: targetValue,
      });
    }));

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html[0].querySelectorAll('.js-item-delete').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();

      const item = this.actor.items.get(e.currentTarget.dataset.itemId);
      if (item) {
        item.delete();
      }
    }));

    // Active Effect management
    html.find('.effect-control').click(ev => onManageActiveEffect(ev, this.actor));

    html.find('[data-gauge-roll]').click(this._onGaugeRoll.bind(this));

    html.find('[data-adrenaline]').click(this._onAdrenalineUse.bind(this));

    // Rollable abilities.
    // html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  async _onDropItemCreate(itemData) {
    itemData = itemData instanceof Array ? itemData : [itemData];
    const newItems = await this.actor.createEmbeddedDocuments('Item', itemData);

    newItems.forEach(item => {
      switch (item.type) {
        case 'advantage':
        // cascade
        case 'disadvantage':
        // cascade
        case 'personality':
          this._removeCurrentItemAsCharacteristic(item.type);
          this.actor.update({ [`system.${item.type}`]: item.id });

          break;
      }
    });
  }

  _removeCurrentItemAsCharacteristic(type) {
    const itemId = this.actor.system[type] ?? null;
    if (null === itemId) {
      return;
    }

    const item = this.actor.items.get(itemId);
    if (!item) {
      return;
    }

    item.delete();
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  async _onGaugeRoll(event) {
    event.preventDefault();

    const element = event.currentTarget;
    const dataset = element.dataset;
    const roll = new Roll(`d20<=@${dataset.gaugeRoll}.value`, this.actor.getRollData());

    await roll.evaluate({ async: true });

    const maxResult = this.actor.system[dataset.gaugeRoll].value;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `__Jet de ${dataset.gaugeRoll} : ${roll.total <= maxResult ? '__Réussite' : '__Échec'}`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    return roll;
  }

  async _onAdrenalineUse(event) {
    event.preventDefault();

    const element = event.currentTarget;
    if (!element.value) {
      return;
    }

    const adrenaline = this.actor.system.adrenaline[element.value];
    if (!adrenaline) {
      return;
    }

    if (!adrenaline.unlock) {
      ui.notifications.error('__Ce slot d’adrénaline n’est pas encore actif !');

      return;
    }

    if (adrenaline.activated) {
      ui.notifications.error('__Ce slot d’adrénaline est déjà activé !');

      return;
    }

    if (adrenaline.used) {
      ui.notifications.error('__Ce slot d’adrénaline a déjà été utilisé !');

      return;
    }

    this.actor.update({ [`system.adrenaline.${element.value}.activated`]: true });

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    ChatMessage.create({
      speaker: speaker,
      rollMode: CONST.CHAT_MESSAGE_TYPES.OTHER,
      flavor: '__Utilisation d’adrénaline',
      content: `__${this.actor.name} fera son prochain jet sous adrénaline !`,
    });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();

    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if ('item' === dataset.rollType) {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const label = dataset.label ? `[ability] ${dataset.label}` : '';
      const roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
}
