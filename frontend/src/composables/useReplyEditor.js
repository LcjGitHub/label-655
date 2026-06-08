import { reactive, onUnmounted } from 'vue'
import { stripHtml } from '../utils/sanitize.js'
import { buildEditorConfig, defaultToolbarConfig } from './useEditor.js'

const EMPTY_HTML = '<p><br></p>'

const createEditorState = () => ({
  showForm: false,
  htmlContent: EMPTY_HTML,
  plainTextLength: 0,
  editorRef: null,
  submitting: false,
  error: ''
})

export const useReplyEditor = (options = {}) => {
  const {
    placeholder = '写下你的回复...',
    maxLength = 300,
    onSubmit,
    onSuccess
  } = options

  const states = reactive({})

  const ensureState = (key) => {
    if (!states[key]) {
      states[key] = createEditorState()
    }
    return states[key]
  }

  const getState = (key) => states[key]

  const isFormVisible = (key) => {
    const s = getState(key)
    return s?.showForm ?? false
  }

  const getHtmlContent = (key) => {
    const s = getState(key)
    return s?.htmlContent ?? EMPTY_HTML
  }

  const getPlainTextLength = (key) => {
    const s = getState(key)
    return s?.plainTextLength ?? 0
  }

  const getEditorRef = (key) => {
    const s = getState(key)
    return s?.editorRef ?? null
  }

  const isSubmitting = (key) => {
    const s = getState(key)
    return s?.submitting ?? false
  }

  const getError = (key) => {
    const s = getState(key)
    return s?.error ?? ''
  }

  const getEditorConfig = (key) => {
    ensureState(key)
    const errorProxy = {
      get value() {
        return states[key]?.error ?? ''
      },
      set value(v) {
        if (states[key]) {
          states[key].error = v
        }
      }
    }
    return buildEditorConfig(placeholder, errorProxy)
  }

  const toolbarConfig = defaultToolbarConfig

  const handleEditorCreated = (key, editor) => {
    ensureState(key)
    states[key].editorRef = editor
    states[key].plainTextLength = stripHtml(editor.getHtml()).length
  }

  const handleEditorChange = (key, editor) => {
    ensureState(key)
    const html = editor.getHtml()
    states[key].htmlContent = html
    states[key].plainTextLength = stripHtml(html).length
    states[key].error = ''
  }

  const openForm = (key) => {
    ensureState(key)
    states[key].showForm = true
    states[key].htmlContent = EMPTY_HTML
    states[key].plainTextLength = 0
    states[key].error = ''
  }

  const destroyEditorForKey = (key) => {
    const s = getState(key)
    if (s?.editorRef) {
      s.editorRef.destroy()
      s.editorRef = null
    }
  }

  const closeForm = (key) => {
    const s = getState(key)
    if (!s) return
    s.showForm = false
    s.htmlContent = EMPTY_HTML
    s.plainTextLength = 0
    s.error = ''
    destroyEditorForKey(key)
  }

  const toggleForm = (key, shouldOpen = null) => {
    const current = isFormVisible(key)
    const next = shouldOpen !== null ? shouldOpen : !current
    if (next) {
      openForm(key)
    } else {
      closeForm(key)
    }
    return next
  }

  const clearEditor = (key) => {
    const s = getState(key)
    if (!s) return
    s.htmlContent = EMPTY_HTML
    s.plainTextLength = 0
    if (s.editorRef) {
      s.editorRef.clear()
    }
  }

  const isValid = (key) => {
    const len = getPlainTextLength(key)
    return len > 0 && len <= maxLength
  }

  const submit = async (key, ...args) => {
    if (!isValid(key)) return false

    ensureState(key)
    states[key].submitting = true
    states[key].error = ''

    try {
      const result = await onSubmit?.(key, states[key].htmlContent, ...args)
      clearEditor(key)
      closeForm(key)
      await onSuccess?.(key, result, ...args)
      return true
    } catch (err) {
      states[key].error = err?.response?.data?.error || '提交失败，请稍后重试'
      console.error(err)
      return false
    } finally {
      states[key].submitting = false
    }
  }

  const destroyAllEditors = () => {
    Object.keys(states).forEach((key) => {
      destroyEditorForKey(key)
    })
  }

  const getWarningThreshold = () => Math.floor(maxLength * 0.9)

  const getCharCountClass = (key) => {
    const len = getPlainTextLength(key)
    const warnAt = getWarningThreshold()
    return {
      'char-count-warning': len > warnAt && len <= maxLength,
      'char-count-error': len > maxLength
    }
  }

  const getDisplayText = (key) => {
    return `${getPlainTextLength(key) || 0}/${maxLength}`
  }

  onUnmounted(() => {
    destroyAllEditors()
  })

  return {
    states,
    maxLength,
    toolbarConfig,
    isFormVisible,
    getHtmlContent,
    getPlainTextLength,
    getEditorRef,
    isSubmitting,
    getError,
    getEditorConfig,
    handleEditorCreated,
    handleEditorChange,
    openForm,
    closeForm,
    toggleForm,
    clearEditor,
    isValid,
    submit,
    destroyAllEditors,
    getCharCountClass,
    getDisplayText
  }
}
