import { ref, shallowRef, onUnmounted } from 'vue'
import { stripHtml } from '../utils/sanitize.js'
import { uploadImage } from '../utils/api.js'
import { compressImage } from './useImageCompress.js'

export const defaultToolbarConfig = {
  toolbarKeys: [
    'bold',
    'italic',
    'underline',
    'bulletedList',
    'numberedList',
    'insertLink',
    'uploadImage'
  ]
}

export const createUploadConfig = (errorRef) => ({
  MENU_CONF: {
    uploadImage: {
      async customUpload(file, insertFn) {
        try {
          if (!file.type.startsWith('image/')) {
            throw new Error('只能上传图片文件')
          }
          if (file.size > 5 * 1024 * 1024) {
            throw new Error('图片大小不能超过 5MB')
          }
          const compressedFile = await compressImage(file)
          const formData = new FormData()
          formData.append('image', compressedFile)
          const response = await uploadImage(formData)
          insertFn(response.data.url, file.name, response.data.url)
        } catch (err) {
          console.error('图片上传失败:', err)
          if (errorRef && typeof errorRef === 'object' && 'value' in errorRef) {
            errorRef.value = err.message || '图片上传失败，请重试'
          }
        }
      }
    }
  }
})

export const buildEditorConfig = (placeholder, errorRef) => {
  return {
    placeholder,
    ...createUploadConfig(errorRef)
  }
}

export const useEditor = (options = {}) => {
  const {
    initialHtml = '<p><br></p>',
    placeholder = '',
    maxLength = 500,
    autoDestroy = true
  } = options

  const htmlContent = ref(initialHtml)
  const plainTextLength = ref(0)
  const editorRef = shallowRef(null)
  const error = ref('')

  const editorConfig = buildEditorConfig(placeholder, error)

  const handleEditorCreated = (editor) => {
    editorRef.value = editor
    plainTextLength.value = stripHtml(editor.getHtml()).length
  }

  const handleEditorChange = (editor) => {
    const html = editor.getHtml()
    htmlContent.value = html
    plainTextLength.value = stripHtml(html).length
    error.value = ''
  }

  const setContent = (html) => {
    htmlContent.value = html || '<p><br></p>'
    plainTextLength.value = stripHtml(html || '').length
    if (editorRef.value) {
      editorRef.value.setHtml(htmlContent.value)
    }
  }

  const clearContent = () => {
    htmlContent.value = '<p><br></p>'
    plainTextLength.value = 0
    error.value = ''
    if (editorRef.value) {
      editorRef.value.clear()
    }
  }

  const destroyEditor = () => {
    if (editorRef.value) {
      editorRef.value.destroy()
      editorRef.value = null
    }
  }

  const reset = () => {
    clearContent()
  }

  if (autoDestroy) {
    onUnmounted(() => {
      destroyEditor()
    })
  }

  return {
    htmlContent,
    plainTextLength,
    editorRef,
    error,
    editorConfig,
    toolbarConfig: defaultToolbarConfig,
    handleEditorCreated,
    handleEditorChange,
    setContent,
    clearContent,
    destroyEditor,
    reset
  }
}
