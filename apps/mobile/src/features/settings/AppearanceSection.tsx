import { RadioGroup, type RadioOption, type ThemePreference, useTheme } from '@/ui'

const OPTIONS: ReadonlyArray<RadioOption<ThemePreference>> = [
  { value: 'light', label: 'Clair', icon: 'sun' },
  { value: 'dark', label: 'Sombre', icon: 'moon' },
  { value: 'system', label: 'Système', icon: 'smartphone' },
]

/** Thème de l'app : clair, sombre ou celui d'Android (équivalent du `ThemeToggle` du web). */
export function AppearanceSection() {
  const { preference, setPreference } = useTheme()
  return (
    <RadioGroup
      label="Apparence"
      value={preference}
      onValueChange={setPreference}
      options={OPTIONS}
    />
  )
}
