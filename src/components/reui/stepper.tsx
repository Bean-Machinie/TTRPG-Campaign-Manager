import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react'
import { cn } from '../../lib/cn'

type StepState = 'active' | 'completed' | 'inactive'
type StepperContextValue = {
  activeStep: number
  setActiveStep: (step: number) => void
  rootRef: React.RefObject<HTMLDivElement | null>
}
type StepItemContextValue = { step: number; state: StepState; disabled: boolean }

const StepperContext = createContext<StepperContextValue | null>(null)
const StepItemContext = createContext<StepItemContextValue | null>(null)

function useStepperContext() {
  const value = useContext(StepperContext)
  if (!value) throw new Error('Stepper components must be rendered inside Stepper.')
  return value
}

function useStepItemContext() {
  const value = useContext(StepItemContext)
  if (!value) throw new Error('This component must be rendered inside StepperItem.')
  return value
}

type StepperProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
}

function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  className,
  children,
  ...props
}: StepperProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeStep = value ?? internalValue
  const context = useMemo(
    () => ({
      activeStep,
      setActiveStep: (next: number) => {
        if (value === undefined) setInternalValue(next)
        onValueChange?.(next)
      },
      rootRef,
    }),
    [activeStep, onValueChange, value],
  )

  return (
    <StepperContext.Provider value={context}>
      <div ref={rootRef} className={cn('w-full', className)} data-slot="stepper" {...props}>
        {children}
      </div>
    </StepperContext.Provider>
  )
}

type StepperItemProps = HTMLAttributes<HTMLDivElement> & {
  step: number
  completed?: boolean
  disabled?: boolean
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepperContext()
  const state: StepState =
    completed || step < activeStep ? 'completed' : step === activeStep ? 'active' : 'inactive'

  return (
    <StepItemContext.Provider value={{ step, state, disabled }}>
      <div
        className={cn('group/step flex min-w-0 items-center justify-center not-last:flex-1', className)}
        data-slot="stepper-item"
        data-state={state}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  )
}

function StepperTrigger({ className, onKeyDown, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { activeStep, rootRef, setActiveStep } = useStepperContext()
  const { step, state, disabled } = useStepItemContext()

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const triggers = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-slot="stepper-trigger"]:not(:disabled)') ?? [],
    )
    const current = triggers.indexOf(event.currentTarget)
    let target = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      target = (current + 1) % triggers.length
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      target = (current - 1 + triggers.length) % triggers.length
    }
    if (event.key === 'Home') target = 0
    if (event.key === 'End') target = triggers.length - 1
    if (target >= 0) {
      event.preventDefault()
      triggers[target]?.focus()
    }
  }

  return (
    <button
      type="button"
      role="tab"
      id={`stepper-tab-${step}`}
      aria-controls={`stepper-panel-${step}`}
      aria-selected={activeStep === step}
      disabled={disabled}
      tabIndex={activeStep === step ? 0 : -1}
      data-slot="stepper-trigger"
      data-state={state}
      className={cn(
        'inline-flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={() => setActiveStep(step)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

function StepperIndicator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { state } = useStepItemContext()
  return (
    <div
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 transition-colors dark:bg-gray-800 dark:text-gray-400',
        'data-[state=active]:bg-brand-600 data-[state=active]:text-gray-950',
        'data-[state=completed]:bg-success-500 data-[state=completed]:text-gray-50',
        className,
      )}
      data-slot="stepper-indicator"
      data-state={state}
      {...props}
    />
  )
}

function StepperSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { state } = useStepItemContext()
  return (
    <div
      className={cn(
        'mx-1 h-0.5 min-w-2 flex-1 rounded-full bg-gray-200 transition-colors dark:bg-gray-700',
        'data-[state=completed]:bg-success-500 dark:data-[state=completed]:bg-success-500',
        className,
      )}
      data-slot="stepper-separator"
      data-state={state}
      {...props}
    />
  )
}

function StepperNav({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      role="tablist"
      aria-label="Creation steps"
      className={cn('flex w-full flex-row items-center', className)}
      data-slot="stepper-nav"
      {...props}
    />
  )
}

function StepperPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full', className)} data-slot="stepper-panel" {...props} />
}

type StepperContentProps = HTMLAttributes<HTMLDivElement> & { value: number }

function StepperContent({ value, className, ...props }: StepperContentProps) {
  const { activeStep } = useStepperContext()
  if (value !== activeStep) return null
  return (
    <div
      role="tabpanel"
      id={`stepper-panel-${value}`}
      aria-labelledby={`stepper-tab-${value}`}
      className={cn('w-full', className)}
      data-slot="stepper-content"
      {...props}
    />
  )
}

export {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
}
export type { StepperContentProps, StepperItemProps, StepperProps }
