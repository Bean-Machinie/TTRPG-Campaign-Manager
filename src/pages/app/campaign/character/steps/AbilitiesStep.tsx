import { useState } from 'react'
import { findBackground, pointBuyCost } from '../../../../../entities/srd/catalog'
import {
  ABILITY_METHOD_LABELS,
  detectAbilityMethod,
  hitPointResources,
} from '../../../../../entities/wizard/steps'
import type { AbilityMethod } from '../../../../../entities/wizard/steps'
import { formatModifier } from '../../../../../entities/entityData'
import { ChoiceCards } from '../../../../../components/diceui/ChoiceCards'
import { Dices, PencilRuler, SlidersHorizontal } from 'lucide-react'
import type { StepProps } from '../stepProps'

/**
 * Step four: the six numbers.
 *
 * Two things this step refuses to do, both of which the old form did by
 * omission.
 *
 * It does not pretend there is one way to get a score. Standard array, point
 * buy and entering what you rolled are three different procedures with three
 * different constraints, and a row of bare number boxes silently assumes the
 * third while offering no help with the first two.
 *
 * And it does not fold the background's increase into the total. A 17 that is
 * "15 assigned, +2 from Soldier" is two facts, and a character sheet that shows
 * only their sum is a sheet you cannot check. The base and the increase are
 * separate rows here and separate fields in the blob; `abilities` still holds
 * the total, so nothing downstream has to know this distinction exists.
 */
export function AbilitiesStep({ draft, context, onPatchData }: StepProps) {
  const { definition, catalog } = context
  const abilities = definition.abilities

  const increases = draft.data.abilityIncreases
  const base = Object.fromEntries(
    abilities.map((ability) => [
      ability.key,
      (draft.data.abilities[ability.key] ?? 0) - (increases[ability.key] ?? 0),
    ]),
  )

  const assigned = abilities.some((ability) => draft.data.abilities[ability.key] !== undefined)

  // The method is not stored — see detectAbilityMethod. It is recovered from
  // the scores on the way in, and owned by this component from there, because
  // "which method am I using" is a question about the next keystroke rather
  // than a fact about the character.
  const [method, setMethod] = useState<AbilityMethod>(() =>
    assigned
      ? detectAbilityMethod(
          abilities.map((ability) => base[ability.key] ?? 0),
          catalog,
        )
      : 'standardArray',
  )

  const background = findBackground(catalog, draft.data.background)
  const standardArray = catalog?.abilityScores.standardArray ?? []
  const pointBuy = catalog?.abilityScores.pointBuy

  const spent =
    pointBuy && catalog
      ? pointBuyCost(
          catalog.abilityScores,
          abilities.map((ability) => base[ability.key] ?? 0),
        )
      : null

  function writeScores(nextBase: Record<string, number>, nextIncreases: Record<string, number>) {
    const totals: Record<string, number> = {}
    for (const ability of abilities) {
      const score = nextBase[ability.key]
      if (typeof score === 'number' && score > 0) {
        totals[ability.key] = score + (nextIncreases[ability.key] ?? 0)
      }
    }

    const ahead = {
      ...draft,
      data: { ...draft.data, abilities: totals, abilityIncreases: nextIncreases },
    }
    const resources = hitPointResources(ahead, context)

    onPatchData({
      abilities: totals,
      abilityIncreases: nextIncreases,
      // Constitution moved, so the hit points worked out on step two are wrong.
      ...(resources ? { resources } : {}),
    })
  }

  function setBase(key: string, value: number | null) {
    const next = { ...base }
    if (value === null) delete next[key]
    else next[key] = value

    writeScores(next, increases)
  }

  function setIncrease(key: string, amount: number) {
    const next = { ...increases }
    if (amount === 0) delete next[key]
    else next[key] = amount

    writeScores(base, next)
  }

  /** Switching method clears the scores rather than reinterpreting them. */
  function changeMethod(next: AbilityMethod) {
    setMethod(next)
    if (next !== method) writeScores({}, increases)
  }

  return (
    <div className="flex flex-col gap-6">
      <ChoiceCards
        compact
        label="Choose a score method"
        value={method}
        onValueChange={(value) => changeMethod(value as AbilityMethod)}
        options={[
          {
            value: 'standardArray',
            label: ABILITY_METHOD_LABELS.standardArray,
            description: standardArray.length > 0 ? standardArray.join(', ') : 'Use the ruleset array.',
            icon: <SlidersHorizontal aria-hidden="true" />,
            disabled: !catalog,
          },
          {
            value: 'pointBuy',
            label: ABILITY_METHOD_LABELS.pointBuy,
            description: pointBuy ? `${pointBuy.budget} points to spend.` : 'Use the ruleset budget.',
            icon: <PencilRuler aria-hidden="true" />,
            disabled: !catalog,
          },
          {
            value: 'manual',
            label: ABILITY_METHOD_LABELS.manual,
            description: 'Enter rolled or custom values.',
            icon: <Dices aria-hidden="true" />,
          },
        ]}
      />

      {method === 'standardArray' ? (
        <p className="ability-builder__budget">
          Assign each value once: <strong>{standardArray.join(', ')}</strong>
        </p>
      ) : null}

      {method === 'pointBuy' && pointBuy ? (
        <p className="ability-builder__budget">
          {spent === null
            ? 'Scores begin between 8 and 15.'
            : <><strong>{spent}</strong> of {pointBuy.budget} points spent.</>}
        </p>
      ) : null}

      <div className="ability-builder-grid">
        {abilities.map((ability) => {
            const scored = base[ability.key] || null
            const increase = increases[ability.key] ?? 0
            const total = scored === null ? null : scored + increase
            const modifier =
              total === null
                ? null
                : Math.floor(
                    (total - definition.abilityModifier.offset) / definition.abilityModifier.divisor,
                  )

            const raisable = background ? background.abilities.includes(ability.key) : true

            return (
              <article key={ability.key} className="ability-builder-card">
                <header className="ability-builder-card__header">
                  <span>
                    <strong>{ability.abbr}</strong>
                    <small>{ability.name}</small>
                  </span>
                  <span className="ability-builder-card__total">{total ?? '—'}</span>
                </header>

                <div className="ability-builder-card__controls">
                  <label>
                    <span>Base score</span>
                  {method === 'manual' ? (
                    <input
                      aria-label={`${ability.name} score`}
                      type="number"
                      className="field__input"
                      min={definition.abilityScoreRange.min}
                      max={definition.abilityScoreRange.max}
                      value={scored ?? ''}
                      onChange={(event) =>
                        setBase(ability.key, numberOrNull(event.target.value))
                      }
                    />
                  ) : (
                    <select
                      aria-label={`${ability.name} score`}
                      className="field__input field__select"
                      value={scored ?? ''}
                      onChange={(event) =>
                        setBase(ability.key, numberOrNull(event.target.value))
                      }
                    >
                      <option value="">—</option>
                      {choicesFor(method, standardArray, pointBuy?.costs).map((value) => (
                        <option
                          key={value}
                          value={value}
                          // The standard array is six numbers assigned once
                          // each. Point buy is not — three 15s is a legal, and
                          // popular, way to spend 27 points.
                          disabled={
                            method === 'standardArray' &&
                            abilities.some(
                              (other) =>
                                other.key !== ability.key && base[other.key] === value,
                            )
                          }
                        >
                          {value}
                        </option>
                      ))}
                    </select>
                  )}
                  </label>

                  <label>
                    <span>Origin bonus</span>
                  {/*
                    Its own column rather than a note beside the total. The
                    background's increase is a decision the player makes, and a
                    decision needs somewhere to be made.
                  */}
                  <select
                    aria-label={`${ability.name} increase`}
                    className="field__input field__select"
                    disabled={!raisable}
                    value={increase || ''}
                    onChange={(event) => setIncrease(ability.key, Number(event.target.value) || 0)}
                  >
                    <option value="">—</option>
                    <option value="1">+1</option>
                    <option value="2">+2</option>
                  </select>
                  </label>
                </div>

                <footer className="ability-builder-card__footer">
                  <span>Modifier</span>
                  <strong>{formatModifier(modifier)}</strong>
                </footer>
              </article>
            )
          })}
      </div>

      {background ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {background.name} raises one ability by 2 and another by 1, or three by 1 each.
        </p>
      ) : null}
    </div>
  )
}

/** Which scores the chosen method allows, in the order a list should show them. */
function choicesFor(
  method: AbilityMethod,
  standardArray: number[],
  costs: Record<number, number> | undefined,
): number[] {
  if (method === 'standardArray') return [...standardArray].sort((a, b) => b - a)
  if (method === 'pointBuy' && costs) {
    return Object.keys(costs)
      .map(Number)
      .sort((a, b) => b - a)
  }
  return []
}

function numberOrNull(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? Math.trunc(value) : null
}
