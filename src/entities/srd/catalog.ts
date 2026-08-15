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
  /**
   * Reference text for the detail page's Features tab, by level.
   *
   * Empty for now, and empty rather than approximate: a features list that is
   * half right is worse than one that is honestly absent, because a player
   * reading it cannot tell which half they are looking at.
   */
  features: Array<{ level: number; name: string }>
}

export type SpeciesEntry = {
  key: string
  name: string
  size: string
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
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
      features: [],
    },
  ],

  species: [
    {
      key: 'dragonborn',
      name: 'Dragonborn',
      size: 'Medium',
      speed: 30,
      traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Darkvision'],
    },
    {
      key: 'dwarf',
      name: 'Dwarf',
      size: 'Medium',
      speed: 30,
      traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    },
    {
      key: 'elf',
      name: 'Elf',
      size: 'Medium',
      speed: 30,
      traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'],
      // Keen Senses.
      skillChoices: { choose: 1, from: ['insight', 'perception', 'survival'] },
    },
    {
      key: 'gnome',
      name: 'Gnome',
      size: 'Small',
      speed: 30,
      traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'],
    },
    {
      key: 'goliath',
      name: 'Goliath',
      size: 'Medium',
      speed: 35,
      traits: ['Giant Ancestry', 'Large Form', 'Powerful Build'],
    },
    {
      key: 'halfling',
      name: 'Halfling',
      size: 'Small',
      speed: 30,
      traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    },
    {
      key: 'human',
      name: 'Human',
      size: 'Medium',
      speed: 30,
      traits: ['Resourceful', 'Skillful', 'Versatile'],
      // Skillful, which is any skill at all.
      skillChoices: { choose: 1, from: [] },
    },
    {
      key: 'orc',
      name: 'Orc',
      size: 'Medium',
      speed: 30,
      traits: ['Adrenaline Rush', 'Darkvision', 'Relentless Endurance'],
    },
    {
      key: 'tiefling',
      name: 'Tiefling',
      size: 'Medium',
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
    },
    {
      key: 'artisan',
      name: 'Artisan',
      abilities: ['str', 'dex', 'int'],
      skills: ['investigation', 'persuasion'],
      feat: 'Crafter',
    },
    {
      key: 'charlatan',
      name: 'Charlatan',
      abilities: ['dex', 'con', 'cha'],
      skills: ['deception', 'sleightOfHand'],
      feat: 'Skilled',
    },
    {
      key: 'criminal',
      name: 'Criminal',
      abilities: ['dex', 'con', 'int'],
      skills: ['sleightOfHand', 'stealth'],
      feat: 'Alert',
    },
    {
      key: 'entertainer',
      name: 'Entertainer',
      abilities: ['str', 'dex', 'cha'],
      skills: ['acrobatics', 'performance'],
      feat: 'Musician',
    },
    {
      key: 'farmer',
      name: 'Farmer',
      abilities: ['str', 'con', 'wis'],
      skills: ['animalHandling', 'nature'],
      feat: 'Tough',
    },
    {
      key: 'guard',
      name: 'Guard',
      abilities: ['str', 'int', 'wis'],
      skills: ['athletics', 'perception'],
      feat: 'Alert',
    },
    {
      key: 'guide',
      name: 'Guide',
      abilities: ['dex', 'con', 'wis'],
      skills: ['stealth', 'survival'],
      feat: 'Magic Initiate (Druid)',
    },
    {
      key: 'hermit',
      name: 'Hermit',
      abilities: ['con', 'wis', 'cha'],
      skills: ['medicine', 'religion'],
      feat: 'Healer',
    },
    {
      key: 'merchant',
      name: 'Merchant',
      abilities: ['con', 'int', 'cha'],
      skills: ['animalHandling', 'persuasion'],
      feat: 'Lucky',
    },
    {
      key: 'noble',
      name: 'Noble',
      abilities: ['str', 'int', 'cha'],
      skills: ['history', 'persuasion'],
      feat: 'Skilled',
    },
    {
      key: 'sage',
      name: 'Sage',
      abilities: ['con', 'int', 'wis'],
      skills: ['arcana', 'history'],
      feat: 'Magic Initiate (Wizard)',
    },
    {
      key: 'sailor',
      name: 'Sailor',
      abilities: ['str', 'dex', 'wis'],
      skills: ['acrobatics', 'perception'],
      feat: 'Tavern Brawler',
    },
    {
      key: 'scribe',
      name: 'Scribe',
      abilities: ['dex', 'int', 'wis'],
      skills: ['investigation', 'perception'],
      feat: 'Skilled',
    },
    {
      key: 'soldier',
      name: 'Soldier',
      abilities: ['str', 'dex', 'con'],
      skills: ['athletics', 'intimidation'],
      feat: 'Savage Attacker',
    },
    {
      key: 'wayfarer',
      name: 'Wayfarer',
      abilities: ['dex', 'wis', 'cha'],
      skills: ['insight', 'stealth'],
      feat: 'Lucky',
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
