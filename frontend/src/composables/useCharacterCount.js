import { computed } from 'vue'

export const useCharacterCount = (getLength, maxLength, warningThreshold = null) => {
  const warnAt = warningThreshold ?? Math.floor(maxLength * 0.9)

  const charCount = computed(() => getLength())

  const isWarning = computed(() => charCount.value > warnAt && charCount.value <= maxLength)
  const isError = computed(() => charCount.value > maxLength)
  const isValid = computed(() => charCount.value > 0 && charCount.value <= maxLength)

  const charCountClass = computed(() => ({
    'char-count-warning': isWarning.value,
    'char-count-error': isError.value
  }))

  const displayText = computed(() => `${charCount.value || 0}/${maxLength}`)

  return {
    charCount,
    isWarning,
    isError,
    isValid,
    charCountClass,
    displayText
  }
}
