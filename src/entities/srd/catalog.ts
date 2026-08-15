/**
 * What a character can be made of, as data.
 *
 * The creation wizard asks three questions the game system definition cannot
 * answer. Which classes exist and when each gets a subclass. What a background
 * raises and what it makes you proficient in. Which skills a class lets you
 * pick, and how many. None of that belongs in `game_systems.definition`, which
 * describes how the *arithmetic* works — abilities, skills, formulas — and is
 * read by the derivation module on every render. This is content, read once, by
 * a form.
 *
 * It is a module rather than a table on purpose, and the purpose is scope. A
 * `game_content` table is a real feature — rows, policies, an editor, homebrew
 * ownership — and the wizard needs none of that to be built. So the shape here
 * is the shape that table would have, and the lookup below is the seam it would
 * be swapped in behind.
 *
 * Two rules the contents follow:
 *
 *   only what a step reads    A class carries its hit die because step 2 writes
 *                             starting hit points, and its skill list because
 *                             step 5 offers it. It does not carry its rules
 *                             text, because nothing renders that.
 *   names, not prose          Features and traits are listed by name and level.
 *                             The SRD's wording is not transcribed here; a
 *                             reader who wants it has the book.
 *
 * Everything is a *suggestion*. A campaign running homebrew types a class name
 * this file has never heard of, and every step degrades to free text rather
 * than refusing — see `findClass` and friends, which return null and mean it.
 *
 * Content from the SRD 5.2.1, CC-BY-4.0. The notice travels with the ruleset
 * row; see the license block in the entities migration.
 */

export const SRD_REFERENCE = {
  version: '5.2.1',
  revision: '1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4',
  repositoryUrl: 'https://github.com/downfallx/dnd-5e-srd-markdown',
  classesUrl:
    'https://github.com/downfallx/dnd-5e-srd-markdown/blob/1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4/classes.md',
  originsUrl:
    'https://github.com/downfallx/dnd-5e-srd-markdown/blob/1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4/character-origins.md',
} as const

export type ClassEntry = {
  key: string
  name: string
  /** Sides of the hit die. Step 2 writes starting hit points from this. */
  hitDie: number
  /** The level at which a subclass is chosen. Step 2 hides the field below it. */
  subclassLevel: number
  subclasses: string[]
  /** Ability keys, matching the system definition's `abilities`. */
  savingThrows: string[]
  /** `from: []` means any skill — the bard's case, and nobody else's. */
  skills: { choose: number; from: string[] }
  /** Concise values from the SRD's Core Class Traits table. */
  primaryAbility: string
  weaponProficiencies: string
  toolProficiencies: string | null
  armorTraining: string
  startingEquipment: string
  /**
   * Reference text for the detail page's Features tab, by level.
   *
   * Empty for now, and empty rather than approximate: a features list that is
   * half right is worse than one that is honestly absent, because a player
   * reading it cannot tell which half they are looking at.
   */
  features: Array<{ level: number; name: string; subclass?: string }>
}

export type SpeciesEntry = {
  key: string
  name: string
  /** Some SRD species let the player choose Small or Medium. */
  sizes: string[]
  /** Walking speed in feet, as the sheet's `speed` field would read it. */
  speed: number
  /** Trait names, in the order the SRD lists them. */
  traits: string[]
  /** A few species grant a skill of the player's choosing. Step 5 offers it. */
  skillChoices?: { choose: number; from: string[] }
}

export type BackgroundEntry = {
  key: string
  name: string
  /**
   * The three abilities it can raise: +2 and +1 to two of them, or +1 to each.
   * Ability keys, matching the system definition.
   */
  abilities: string[]
  /** Granted outright, not chosen. Step 5 shows them as already taken. */
  skills: string[]
  /** The origin feat's name. Reference only; feats are not modelled. */
  feat: string
  toolProficiency: string
  startingEquipment: string
}

/** How ability scores may be generated, for step 4's method selector. */
export type AbilityScoreRules = {
  standardArray: number[]
  pointBuy: {
    budget: number
    /** Score to total cost. A score absent from this map cannot be bought. */
    costs: Record<number, number>
  }
}

export type Catalog = {
  classes: ClassEntry[]
  species: SpeciesEntry[]
  backgrounds: BackgroundEntry[]
  abilityScores: AbilityScoreRules
  /**
   * Which ability adds to hit points.
   *
   * Here rather than in the ruleset definition because the definition describes
   * arithmetic, and "Constitution is the tough one" is a fact about the setting
   * of the rules, not about how a modifier is worked out. It is a key into
   * `definition.abilities`, and it exists so that the wizard can write starting
   * hit points without a component hardcoding the string 'con'.
   */
  hitPointAbility: string
}

// ------------------------------------------------------------- the rules --

type ClassFeature = ClassEntry['features'][number]

/**
 * SRD 5.2.1 class-feature headings, indexed for level-aware display.
 *
 * This deliberately stores names rather than rules prose. It gives a player a
 * trustworthy checklist while the linked SRD remains the canonical text.
 */
const CLASS_FEATURES: Record<string, ClassFeature[]> = {
  barbarian: [
    { level: 1, name: 'Rage' },
    { level: 1, name: 'Unarmored Defense' },
    { level: 1, name: 'Weapon Mastery' },
    { level: 2, name: 'Danger Sense' },
    { level: 2, name: 'Reckless Attack' },
    { level: 3, name: 'Barbarian Subclass' },
    { level: 3, name: 'Primal Knowledge' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Extra Attack' },
    { level: 5, name: 'Fast Movement' },
    { level: 7, name: 'Feral Instinct' },
    { level: 7, name: 'Instinctive Pounce' },
    { level: 9, name: 'Brutal Strike' },
    { level: 11, name: 'Relentless Rage' },
    { level: 13, name: 'Improved Brutal Strike' },
    { level: 15, name: 'Persistent Rage' },
    { level: 17, name: 'Improved Brutal Strike' },
    { level: 18, name: 'Indomitable Might' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Primal Champion' },
    { level: 3, name: 'Frenzy', subclass: 'Path of the Berserker' },
    { level: 6, name: 'Mindless Rage', subclass: 'Path of the Berserker' },
    { level: 10, name: 'Retaliation', subclass: 'Path of the Berserker' },
    { level: 14, name: 'Intimidating Presence', subclass: 'Path of the Berserker' },
  ],
  bard: [
    { level: 1, name: 'Bardic Inspiration' },
    { level: 1, name: 'Spellcasting' },
    { level: 2, name: 'Expertise' },
    { level: 2, name: 'Jack of All Trades' },
    { level: 3, name: 'Bard Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Font of Inspiration' },
    { level: 7, name: 'Countercharm' },
    { level: 10, name: 'Magical Secrets' },
    { level: 18, name: 'Superior Inspiration' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Words of Creation' },
    { level: 3, name: 'Bonus Proficiencies', subclass: 'College of Lore' },
    { level: 3, name: 'Cutting Words', subclass: 'College of Lore' },
    { level: 6, name: 'Magical Discoveries', subclass: 'College of Lore' },
    { level: 14, name: 'Peerless Skill', subclass: 'College of Lore' },
  ],
  cleric: [
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Divine Order' },
    { level: 2, name: 'Channel Divinity' },
    { level: 3, name: 'Cleric Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Sear Undead' },
    { level: 7, name: 'Blessed Strikes' },
    { level: 10, name: 'Divine Intervention' },
    { level: 14, name: 'Improved Blessed Strikes' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Greater Divine Intervention' },
    { level: 3, name: 'Disciple of Life', subclass: 'Life Domain' },
    { level: 3, name: 'Preserve Life', subclass: 'Life Domain' },
    { level: 6, name: 'Blessed Healer', subclass: 'Life Domain' },
    { level: 17, name: 'Supreme Healing', subclass: 'Life Domain' },
  ],
  druid: [
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Druidic' },
    { level: 1, name: 'Primal Order' },
    { level: 2, name: 'Wild Shape' },
    { level: 2, name: 'Wild Companion' },
    { level: 3, name: 'Druid Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Wild Resurgence' },
    { level: 7, name: 'Elemental Fury' },
    { level: 15, name: 'Improved Elemental Fury' },
    { level: 18, name: 'Beast Spells' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Archdruid' },
    { level: 3, name: "Land's Aid", subclass: 'Circle of the Land' },
    { level: 6, name: 'Natural Recovery', subclass: 'Circle of the Land' },
    { level: 10, name: "Nature's Ward", subclass: 'Circle of the Land' },
    { level: 14, name: "Nature's Sanctuary", subclass: 'Circle of the Land' },
  ],
  fighter: [
    { level: 1, name: 'Fighting Style' },
    { level: 1, name: 'Second Wind' },
    { level: 1, name: 'Weapon Mastery' },
    { level: 2, name: 'Action Surge' },
    { level: 2, name: 'Tactical Mind' },
    { level: 3, name: 'Fighter Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Extra Attack' },
    { level: 5, name: 'Tactical Shift' },
    { level: 9, name: 'Indomitable' },
    { level: 9, name: 'Tactical Master' },
    { level: 11, name: 'Two Extra Attacks' },
    { level: 13, name: 'Studied Attacks' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Three Extra Attacks' },
    { level: 3, name: 'Improved Critical', subclass: 'Champion' },
    { level: 3, name: 'Remarkable Athlete', subclass: 'Champion' },
    { level: 7, name: 'Additional Fighting Style', subclass: 'Champion' },
    { level: 10, name: 'Heroic Warrior', subclass: 'Champion' },
    { level: 15, name: 'Superior Critical', subclass: 'Champion' },
    { level: 18, name: 'Survivor', subclass: 'Champion' },
  ],
  monk: [
    { level: 1, name: 'Martial Arts' },
    { level: 1, name: 'Unarmored Defense' },
    { level: 2, name: "Monk's Focus" },
    { level: 2, name: 'Unarmored Movement' },
    { level: 2, name: 'Uncanny Metabolism' },
    { level: 3, name: 'Deflect Attacks' },
    { level: 3, name: 'Monk Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 4, name: 'Slow Fall' },
    { level: 5, name: 'Extra Attack' },
    { level: 5, name: 'Stunning Strike' },
    { level: 6, name: 'Empowered Strikes' },
    { level: 7, name: 'Evasion' },
    { level: 9, name: 'Acrobatic Movement' },
    { level: 10, name: 'Heightened Focus' },
    { level: 10, name: 'Self-Restoration' },
    { level: 13, name: 'Deflect Energy' },
    { level: 14, name: 'Disciplined Survivor' },
    { level: 15, name: 'Perfect Focus' },
    { level: 18, name: 'Superior Defense' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Body and Mind' },
    { level: 3, name: 'Open Hand Technique', subclass: 'Warrior of the Open Hand' },
    { level: 6, name: 'Wholeness of Body', subclass: 'Warrior of the Open Hand' },
    { level: 11, name: 'Fleet Step', subclass: 'Warrior of the Open Hand' },
    { level: 17, name: 'Quivering Palm', subclass: 'Warrior of the Open Hand' },
  ],
  paladin: [
    { level: 1, name: 'Lay On Hands' },
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Weapon Mastery' },
    { level: 2, name: 'Fighting Style' },
    { level: 2, name: "Paladin's Smite" },
    { level: 3, name: 'Channel Divinity' },
    { level: 3, name: 'Paladin Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Extra Attack' },
    { level: 5, name: 'Faithful Steed' },
    { level: 6, name: 'Aura of Protection' },
    { level: 9, name: 'Abjure Foes' },
    { level: 10, name: 'Aura of Courage' },
    { level: 11, name: 'Radiant Strikes' },
    { level: 14, name: 'Restoring Touch' },
    { level: 18, name: 'Aura Expansion' },
    { level: 19, name: 'Epic Boon' },
    { level: 3, name: 'Sacred Weapon', subclass: 'Oath of Devotion' },
    { level: 7, name: 'Aura of Devotion', subclass: 'Oath of Devotion' },
    { level: 15, name: 'Smite of Protection', subclass: 'Oath of Devotion' },
    { level: 20, name: 'Holy Nimbus', subclass: 'Oath of Devotion' },
  ],
  ranger: [
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Favored Enemy' },
    { level: 1, name: 'Weapon Mastery' },
    { level: 2, name: 'Deft Explorer' },
    { level: 2, name: 'Fighting Style' },
    { level: 3, name: 'Ranger Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Extra Attack' },
    { level: 6, name: 'Roving' },
    { level: 9, name: 'Expertise' },
    { level: 10, name: 'Tireless' },
    { level: 13, name: 'Relentless Hunter' },
    { level: 14, name: "Nature's Veil" },
    { level: 17, name: 'Precise Hunter' },
    { level: 18, name: 'Feral Senses' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Foe Slayer' },
    { level: 3, name: "Hunter's Lore", subclass: 'Hunter' },
    { level: 3, name: "Hunter's Prey", subclass: 'Hunter' },
    { level: 7, name: 'Defensive Tactics', subclass: 'Hunter' },
    { level: 11, name: "Superior Hunter's Prey", subclass: 'Hunter' },
    { level: 15, name: "Superior Hunter's Defense", subclass: 'Hunter' },
  ],
  rogue: [
    { level: 1, name: 'Expertise' },
    { level: 1, name: 'Sneak Attack' },
    { level: 1, name: "Thieves' Cant" },
    { level: 1, name: 'Weapon Mastery' },
    { level: 2, name: 'Cunning Action' },
    { level: 3, name: 'Rogue Subclass' },
    { level: 3, name: 'Steady Aim' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Cunning Strike' },
    { level: 5, name: 'Uncanny Dodge' },
    { level: 7, name: 'Evasion' },
    { level: 7, name: 'Reliable Talent' },
    { level: 11, name: 'Improved Cunning Strike' },
    { level: 14, name: 'Devious Strikes' },
    { level: 15, name: 'Slippery Mind' },
    { level: 18, name: 'Elusive' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Stroke of Luck' },
    { level: 3, name: 'Fast Hands', subclass: 'Thief' },
    { level: 3, name: 'Second-Story Work', subclass: 'Thief' },
    { level: 9, name: 'Supreme Sneak', subclass: 'Thief' },
    { level: 13, name: 'Use Magic Device', subclass: 'Thief' },
    { level: 17, name: "Thief's Reflexes", subclass: 'Thief' },
  ],
  sorcerer: [
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Innate Sorcery' },
    { level: 2, name: 'Font of Magic' },
    { level: 2, name: 'Metamagic' },
    { level: 3, name: 'Sorcerer Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Sorcerous Restoration' },
    { level: 7, name: 'Sorcery Incarnate' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Arcane Apotheosis' },
    { level: 3, name: 'Draconic Resilience', subclass: 'Draconic Sorcery' },
    { level: 6, name: 'Elemental Affinity', subclass: 'Draconic Sorcery' },
    { level: 14, name: 'Dragon Wings', subclass: 'Draconic Sorcery' },
    { level: 18, name: 'Dragon Companion', subclass: 'Draconic Sorcery' },
  ],
  warlock: [
    { level: 1, name: 'Eldritch Invocations' },
    { level: 1, name: 'Pact Magic' },
    { level: 2, name: 'Magical Cunning' },
    { level: 3, name: 'Warlock Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 9, name: 'Contact Patron' },
    { level: 11, name: 'Mystic Arcanum' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Eldritch Master' },
    { level: 3, name: "Dark One's Blessing", subclass: 'Fiend Patron' },
    { level: 6, name: "Dark One's Own Luck", subclass: 'Fiend Patron' },
    { level: 10, name: 'Fiendish Resilience', subclass: 'Fiend Patron' },
    { level: 14, name: 'Hurl Through Hell', subclass: 'Fiend Patron' },
  ],
  wizard: [
    { level: 1, name: 'Spellcasting' },
    { level: 1, name: 'Ritual Adept' },
    { level: 1, name: 'Arcane Recovery' },
    { level: 2, name: 'Scholar' },
    { level: 3, name: 'Wizard Subclass' },
    { level: 4, name: 'Ability Score Improvement' },
    { level: 5, name: 'Memorize Spell' },
    { level: 18, name: 'Spell Mastery' },
    { level: 19, name: 'Epic Boon' },
    { level: 20, name: 'Signature Spells' },
    { level: 3, name: 'Evocation Savant', subclass: 'Evoker' },
    { level: 3, name: 'Potent Cantrip', subclass: 'Evoker' },
    { level: 10, name: 'Empowered Evocation', subclass: 'Evoker' },
    { level: 14, name: 'Overchannel', subclass: 'Evoker' },
  ],
}

const DND5E: Catalog = {
  classes: [
    {
      key: 'barbarian',
      name: 'Barbarian',
      hitDie: 12,
      subclassLevel: 3,
      subclasses: ['Path of the Berserker'],
      savingThrows: ['str', 'con'],
      skills: {
        choose: 2,
        from: [
          'animalHandling',
          'athletics',
          'intimidation',
          'nature',
          'perception',
          'survival',
        ],
      },
      primaryAbility: 'Strength',
      weaponProficiencies: 'Simple and Martial weapons',
      toolProficiencies: null,
      armorTraining: 'Light and Medium armor and Shields',
      startingEquipment:
        "Choose A or B: (A) Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP; or (B) 75 GP",
      features: CLASS_FEATURES.barbarian,
    },
    {
      key: 'bard',
      name: 'Bard',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['College of Lore'],
      savingThrows: ['dex', 'cha'],
      // The one class that picks from the whole list. An empty `from` says so
      // rather than restating eighteen keys that would then need maintaining
      // alongside the system definition they were copied from.
      skills: { choose: 3, from: [] },
      primaryAbility: 'Charisma',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: 'Choose 3 Musical Instruments',
      armorTraining: 'Light armor',
      startingEquipment:
        "Choose A or B: (A) Leather Armor, 2 Daggers, a Musical Instrument, Entertainer's Pack, and 19 GP; or (B) 90 GP",
      features: CLASS_FEATURES.bard,
    },
    {
      key: 'cleric',
      name: 'Cleric',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['Life Domain'],
      savingThrows: ['wis', 'cha'],
      skills: {
        choose: 2,
        from: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
      },
      primaryAbility: 'Wisdom',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: null,
      armorTraining: 'Light and Medium armor and Shields',
      startingEquipment:
        "Choose A or B: (A) Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, and 7 GP; or (B) 110 GP",
      features: CLASS_FEATURES.cleric,
    },
    {
      key: 'druid',
      name: 'Druid',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['Circle of the Land'],
      savingThrows: ['int', 'wis'],
      skills: {
        choose: 2,
        from: [
          'animalHandling',
          'arcana',
          'insight',
          'medicine',
          'nature',
          'perception',
          'religion',
          'survival',
        ],
      },
      primaryAbility: 'Wisdom',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: 'Herbalism Kit',
      armorTraining: 'Light armor and Shields',
      startingEquipment:
        "Choose A or B: (A) Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit, and 9 GP; or (B) 50 GP",
      features: CLASS_FEATURES.druid,
    },
    {
      key: 'fighter',
      name: 'Fighter',
      hitDie: 10,
      subclassLevel: 3,
      subclasses: ['Champion'],
      savingThrows: ['str', 'con'],
      skills: {
        choose: 2,
        from: [
          'acrobatics',
          'animalHandling',
          'athletics',
          'history',
          'insight',
          'intimidation',
          'perception',
          'persuasion',
          'survival',
        ],
      },
      primaryAbility: 'Strength or Dexterity',
      weaponProficiencies: 'Simple and Martial weapons',
      toolProficiencies: null,
      armorTraining: 'Light, Medium, and Heavy armor and Shields',
      startingEquipment:
        "Choose A, B, or C: (A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, and 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer's Pack, and 11 GP; or (C) 155 GP",
      features: CLASS_FEATURES.fighter,
    },
    {
      key: 'monk',
      name: 'Monk',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['Warrior of the Open Hand'],
      savingThrows: ['str', 'dex'],
      skills: {
        choose: 2,
        from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
      },
      primaryAbility: 'Dexterity and Wisdom',
      weaponProficiencies: 'Simple weapons and Martial weapons with the Light property',
      toolProficiencies: "Choose Artisan's Tools or a Musical Instrument",
      armorTraining: 'None',
      startingEquipment:
        "Choose A or B: (A) Spear, 5 Daggers, chosen tool, Explorer's Pack, and 11 GP; or (B) 50 GP",
      features: CLASS_FEATURES.monk,
    },
    {
      key: 'paladin',
      name: 'Paladin',
      hitDie: 10,
      subclassLevel: 3,
      subclasses: ['Oath of Devotion'],
      savingThrows: ['wis', 'cha'],
      skills: {
        choose: 2,
        from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
      },
      primaryAbility: 'Strength and Charisma',
      weaponProficiencies: 'Simple and Martial weapons',
      toolProficiencies: null,
      armorTraining: 'Light, Medium, and Heavy armor and Shields',
      startingEquipment:
        "Choose A or B: (A) Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest's Pack, and 9 GP; or (B) 150 GP",
      features: CLASS_FEATURES.paladin,
    },
    {
      key: 'ranger',
      name: 'Ranger',
      hitDie: 10,
      subclassLevel: 3,
      subclasses: ['Hunter'],
      savingThrows: ['str', 'dex'],
      skills: {
        choose: 3,
        from: [
          'animalHandling',
          'athletics',
          'insight',
          'investigation',
          'nature',
          'perception',
          'stealth',
          'survival',
        ],
      },
      primaryAbility: 'Dexterity and Wisdom',
      weaponProficiencies: 'Simple and Martial weapons',
      toolProficiencies: null,
      armorTraining: 'Light and Medium armor and Shields',
      startingEquipment:
        "Choose A or B: (A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus, Explorer's Pack, and 7 GP; or (B) 150 GP",
      features: CLASS_FEATURES.ranger,
    },
    {
      key: 'rogue',
      name: 'Rogue',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['Thief'],
      savingThrows: ['dex', 'int'],
      skills: {
        choose: 4,
        from: [
          'acrobatics',
          'athletics',
          'deception',
          'insight',
          'intimidation',
          'investigation',
          'perception',
          'performance',
          'persuasion',
          'sleightOfHand',
          'stealth',
        ],
      },
      primaryAbility: 'Dexterity',
      weaponProficiencies: 'Simple weapons and Martial weapons with the Finesse or Light property',
      toolProficiencies: "Thieves' Tools",
      armorTraining: 'Light armor',
      startingEquipment:
        "Choose A or B: (A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves' Tools, Burglar's Pack, and 8 GP; or (B) 100 GP",
      features: CLASS_FEATURES.rogue,
    },
    {
      key: 'sorcerer',
      name: 'Sorcerer',
      hitDie: 6,
      subclassLevel: 3,
      subclasses: ['Draconic Sorcery'],
      savingThrows: ['con', 'cha'],
      skills: {
        choose: 2,
        from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
      },
      primaryAbility: 'Charisma',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: null,
      armorTraining: 'None',
      startingEquipment:
        "Choose A or B: (A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer's Pack, and 28 GP; or (B) 50 GP",
      features: CLASS_FEATURES.sorcerer,
    },
    {
      key: 'warlock',
      name: 'Warlock',
      hitDie: 8,
      subclassLevel: 3,
      subclasses: ['Fiend Patron'],
      savingThrows: ['wis', 'cha'],
      skills: {
        choose: 2,
        from: [
          'arcana',
          'deception',
          'history',
          'intimidation',
          'investigation',
          'nature',
          'religion',
        ],
      },
      primaryAbility: 'Charisma',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: null,
      armorTraining: 'Light armor',
      startingEquipment:
        "Choose A or B: (A) Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book (occult lore), Scholar's Pack, and 15 GP; or (B) 100 GP",
      features: CLASS_FEATURES.warlock,
    },
    {
      key: 'wizard',
      name: 'Wizard',
      hitDie: 6,
      subclassLevel: 3,
      subclasses: ['Evoker'],
      savingThrows: ['int', 'wis'],
      skills: {
        choose: 2,
        from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
      },
      primaryAbility: 'Intelligence',
      weaponProficiencies: 'Simple weapons',
      toolProficiencies: null,
      armorTraining: 'None',
      startingEquipment:
        "Choose A or B: (A) 2 Daggers, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar's Pack, and 5 GP; or (B) 55 GP",
      features: CLASS_FEATURES.wizard,
    },
  ],

  species: [
    {
      key: 'dragonborn',
      name: 'Dragonborn',
      sizes: ['Medium'],
      speed: 30,
      traits: [
        'Draconic Ancestry',
        'Breath Weapon',
        'Damage Resistance',
        'Darkvision',
        'Draconic Flight',
      ],
    },
    {
      key: 'dwarf',
      name: 'Dwarf',
      sizes: ['Medium'],
      speed: 30,
      traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    },
    {
      key: 'elf',
      name: 'Elf',
      sizes: ['Medium'],
      speed: 30,
      traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'],
      // Keen Senses.
      skillChoices: { choose: 1, from: ['insight', 'perception', 'survival'] },
    },
    {
      key: 'gnome',
      name: 'Gnome',
      sizes: ['Small'],
      speed: 30,
      traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'],
    },
    {
      key: 'goliath',
      name: 'Goliath',
      sizes: ['Medium'],
      speed: 35,
      traits: ['Giant Ancestry', 'Large Form', 'Powerful Build'],
    },
    {
      key: 'halfling',
      name: 'Halfling',
      sizes: ['Small'],
      speed: 30,
      traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    },
    {
      key: 'human',
      name: 'Human',
      sizes: ['Small', 'Medium'],
      speed: 30,
      traits: ['Resourceful', 'Skillful', 'Versatile'],
      // Skillful, which is any skill at all.
      skillChoices: { choose: 1, from: [] },
    },
    {
      key: 'orc',
      name: 'Orc',
      sizes: ['Medium'],
      speed: 30,
      traits: ['Adrenaline Rush', 'Darkvision', 'Relentless Endurance'],
    },
    {
      key: 'tiefling',
      name: 'Tiefling',
      sizes: ['Small', 'Medium'],
      speed: 30,
      traits: ['Darkvision', 'Fiendish Legacy', 'Otherworldly Presence'],
    },
  ],

  backgrounds: [
    {
      key: 'acolyte',
      name: 'Acolyte',
      abilities: ['int', 'wis', 'cha'],
      skills: ['insight', 'religion'],
      feat: 'Magic Initiate (Cleric)',
      toolProficiency: "Calligrapher's Supplies",
      startingEquipment:
        "Choose A or B: (A) Calligrapher's Supplies, Book (prayers), Holy Symbol, 10 sheets of Parchment, Robe, and 8 GP; or (B) 50 GP",
    },
    {
      key: 'criminal',
      name: 'Criminal',
      abilities: ['dex', 'con', 'int'],
      skills: ['sleightOfHand', 'stealth'],
      feat: 'Alert',
      toolProficiency: "Thieves' Tools",
      startingEquipment:
        "Choose A or B: (A) 2 Daggers, Thieves' Tools, Crowbar, 2 Pouches, Traveler's Clothes, and 16 GP; or (B) 50 GP",
    },
    {
      key: 'sage',
      name: 'Sage',
      abilities: ['con', 'int', 'wis'],
      skills: ['arcana', 'history'],
      feat: 'Magic Initiate (Wizard)',
      toolProficiency: "Calligrapher's Supplies",
      startingEquipment:
        "Choose A or B: (A) Quarterstaff, Calligrapher's Supplies, Book (history), 8 sheets of Parchment, Robe, and 8 GP; or (B) 50 GP",
    },
    {
      key: 'soldier',
      name: 'Soldier',
      abilities: ['str', 'dex', 'con'],
      skills: ['athletics', 'intimidation'],
      feat: 'Savage Attacker',
      toolProficiency: 'Choose one Gaming Set',
      startingEquipment:
        "Choose A or B: (A) Spear, Shortbow, 20 Arrows, Gaming Set, Healer's Kit, Quiver, Traveler's Clothes, and 14 GP; or (B) 50 GP",
    },
  ],

  hitPointAbility: 'con',

  abilityScores: {
    standardArray: [15, 14, 13, 12, 10, 8],
    pointBuy: {
      budget: 27,
      // Not a formula. The cost curve bends at 14 — the two points that make
      // a 15 expensive are the entire reason point buy produces different
      // characters from the standard array — and an arithmetic expression that
      // happened to fit would hide that.
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    },
  },
}

const CATALOGS: Record<string, Catalog> = {
  dnd5e: DND5E,
}

/**
 * The content for a ruleset, or null when there is none.
 *
 * Keyed by `game_systems.key` rather than by its uuid, so this survives a
 * database being reseeded. Null is a supported answer: a system with no catalog
 * gets a wizard whose class, species and background steps are free text, which
 * is exactly what the old form offered and no worse.
 */
export function catalogFor(systemKey: string): Catalog | null {
  return CATALOGS[systemKey] ?? null
}

// ------------------------------------------------------------- lookups --
//
// An entity stores a class as the *name* it was given — "Fighter", or "Blood
// Hunter", or "fighter" typed in a hurry — because the blob has to hold
// homebrew that no catalog knows about. So every lookup here is by name, loose
// about case and whitespace, and returns null rather than throwing when it
// finds nothing. Null means "this is homebrew"; it never means "this is wrong".

function byName<T extends { name: string }>(entries: T[], name: string | null): T | null {
  if (!name) return null

  const wanted = name.trim().toLowerCase()
  return entries.find((entry) => entry.name.toLowerCase() === wanted) ?? null
}

export function findClass(catalog: Catalog | null, name: string | null): ClassEntry | null {
  return catalog ? byName(catalog.classes, name) : null
}

export function findSpecies(catalog: Catalog | null, name: string | null): SpeciesEntry | null {
  return catalog ? byName(catalog.species, name) : null
}

export function findBackground(
  catalog: Catalog | null,
  name: string | null,
): BackgroundEntry | null {
  return catalog ? byName(catalog.backgrounds, name) : null
}

/** Core features plus only the selected subclass's features, through a level. */
export function featuresForClass(
  entry: ClassEntry | null,
  level: number,
  subclass: string | null,
): ClassEntry['features'] {
  if (!entry) return []

  return entry.features.filter(
    (feature) => feature.level <= level && (!feature.subclass || feature.subclass === subclass),
  )
}

/**
 * What a set of scores costs under point buy, or null if it cannot be bought.
 *
 * Null rather than Infinity: "this array is not purchasable" is a different
 * statement from "this array is expensive", and the step shows them
 * differently — one is a disabled method, the other a running total.
 */
export function pointBuyCost(rules: AbilityScoreRules, scores: number[]): number | null {
  let total = 0

  for (const score of scores) {
    const cost = rules.pointBuy.costs[score]
    if (cost === undefined) return null
    total += cost
  }

  return total
}
