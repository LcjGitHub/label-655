<template>
  <div class="message-form">
    <h2>✍️ 发表留言</h2>

    <div v-if="!isLoggedIn" class="login-prompt">
      <p class="prompt-text">🔒 请登录后发表留言</p>
      <div class="prompt-buttons">
        <router-link to="/login" class="prompt-btn login-btn">立即登录</router-link>
        <router-link to="/register" class="prompt-btn register-btn">注册账户</router-link>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <div class="avatar-upload-section">
        <label class="section-label">选择头像</label>
        <div
          class="avatar-uploader"
          :class="{ 'is-dragging': isDragging, 'has-avatar': avatarUrl }"
          @click="triggerFileInput"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <div v-if="avatarUrl" class="avatar-preview-wrapper">
            <img :src="avatarUrl" alt="头像预览" class="avatar-preview" />
            <button type="button" class="avatar-remove" @click.stop="removeAvatar" title="移除头像">
              ×
            </button>
          </div>
          <div v-else class="avatar-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p class="upload-hint">点击或拖拽图片到此处</p>
            <p class="upload-tip">支持 JPG、PNG、GIF，不超过 2MB</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            class="hidden-input"
            @change="handleFileSelect"
          />
        </div>
        <p v-if="uploadError" class="avatar-error">{{ uploadError }}</p>
        <p v-if="uploading" class="avatar-uploading">上传中...</p>
      </div>

      <div class="form-group">
        <label for="username">用户名</label>
        <div class="input-with-badge">
          <input
            id="username"
            :value="currentUser?.username"
            type="text"
            disabled
            class="disabled-input"
          />
          <span class="user-badge">已登录</span>
        </div>
      </div>

      <div class="form-group">
        <label for="content">留言内容</label>
        <textarea
          id="content"
          v-model="form.content"
          placeholder="分享您的想法..."
          rows="4"
          maxlength="500"
          :disabled="submitting"
        ></textarea>
        <span class="char-count">{{ form.content.length }}/500</span>
      </div>

      <button type="submit" class="submit-btn" :disabled="submitting || !isValid || uploading">
        {{ submitting ? '提交中...' : '发布留言' }}
      </button>

      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">留言发布成功！</p>
    </form>

    <div v-if="cropDialogVisible" class="crop-dialog-overlay" @click.self="closeCropDialog">
      <div class="crop-dialog">
        <div class="crop-dialog-header">
          <h3>裁剪头像</h3>
          <button type="button" class="crop-close-btn" @click="closeCropDialog">×</button>
        </div>
        <div class="crop-dialog-body">
          <div class="crop-wrapper" ref="cropWrapper">
            <img ref="cropImage" :src="cropImageSrc" class="crop-image" @load="onCropImageLoad" />
            <div
              class="crop-selection"
              :style="cropSelectionStyle"
              @mousedown.prevent="startCropDrag"
            >
              <div class="crop-handle crop-handle-nw" @mousedown.stop.prevent="startResize('nw', $event)"></div>
              <div class="crop-handle crop-handle-ne" @mousedown.stop.prevent="startResize('ne', $event)"></div>
              <div class="crop-handle crop-handle-sw" @mousedown.stop.prevent="startResize('sw', $event)"></div>
              <div class="crop-handle crop-handle-se" @mousedown.stop.prevent="startResize('se', $event)"></div>
            </div>
          </div>
          <p class="crop-tip">拖动选框调整位置，拖动边角调整大小（保持正方形）</p>
        </div>
        <div class="crop-dialog-footer">
          <button type="button" class="cancel-btn" @click="closeCropDialog">取消</button>
          <button type="button" class="submit-reply-btn" @click="confirmCrop" :disabled="cropping">
            {{ cropping ? '处理中...' : '确认裁剪' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { submitMessage, uploadAvatar } from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'

const emit = defineEmits(['submitted'])
const authStore = useAuthStore()

const isLoggedIn = authStore.isLoggedIn
const currentUser = authStore.currentUser

const form = ref({
  content: ''
})

const submitting = ref(false)
const error = ref('')
const success = ref(false)

const fileInput = ref(null)
const avatarUrl = ref('')
const uploading = ref(false)
const uploadError = ref('')
const isDragging = ref(false)

const cropDialogVisible = ref(false)
const cropImageSrc = ref('')
const cropImage = ref(null)
const cropWrapper = ref(null)
const cropping = ref(false)

const cropSelection = ref({
  x: 0,
  y: 0,
  size: 100
})

const naturalImageSize = ref({ width: 0, height: 0 })
const displayImageSize = ref({ width: 0, height: 0 })
const imageScale = ref(1)

let cropDragMode = null
let cropDragStart = null
let cropSelectionStart = null

const isValid = computed(() => {
  return form.value.content.trim() !== ''
})

const cropSelectionStyle = computed(() => ({
  left: `${cropSelection.value.x}px`,
  top: `${cropSelection.value.y}px`,
  width: `${cropSelection.value.size}px`,
  height: `${cropSelection.value.size}px`
}))

const triggerFileInput = () => {
  if (avatarUrl.value) return
  fileInput.value?.click()
}

const validateFile = (file) => {
  uploadError.value = ''
  if (!file) {
    uploadError.value = '请选择图片文件'
    return false
  }
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    uploadError.value = '只支持 JPG、PNG、GIF 格式的图片'
    return false
  }
  if (file.size > 2 * 1024 * 1024) {
    uploadError.value = '图片大小不能超过 2MB'
    return false
  }
  return true
}

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) {
    processFile(file)
  }
}

const handleDragOver = () => {
  if (!avatarUrl.value) {
    isDragging.value = true
  }
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (e) => {
  isDragging.value = false
  if (avatarUrl.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

const processFile = (file) => {
  if (!validateFile(file)) return

  const reader = new FileReader()
  reader.onload = (e) => {
    cropImageSrc.value = e.target.result
    cropDialogVisible.value = true
  }
  reader.onerror = () => {
    uploadError.value = '读取图片失败，请重试'
  }
  reader.readAsDataURL(file)
}

const onCropImageLoad = () => {
  const img = cropImage.value
  if (!img) return

  naturalImageSize.value = {
    width: img.naturalWidth,
    height: img.naturalHeight
  }

  const maxWidth = 500
  const maxHeight = 400

  let displayWidth = naturalImageSize.value.width
  let displayHeight = naturalImageSize.value.height

  const scale = Math.min(maxWidth / displayWidth, maxHeight / displayHeight, 1)
  displayWidth = Math.floor(displayWidth * scale)
  displayHeight = Math.floor(displayHeight * scale)

  displayImageSize.value = { width: displayWidth, height: displayHeight }
  imageScale.value = scale

  img.style.width = `${displayWidth}px`
  img.style.height = `${displayHeight}px`
  if (cropWrapper.value) {
    cropWrapper.value.style.width = `${displayWidth}px`
    cropWrapper.value.style.height = `${displayHeight}px`
  }

  const minSide = Math.min(displayWidth, displayHeight)
  cropSelection.value = {
    x: Math.floor((displayWidth - minSide) / 2),
    y: Math.floor((displayHeight - minSide) / 2),
    size: minSide
  }
}

const getEventPos = (e) => ({
  x: e.clientX,
  y: e.clientY
})

const startCropDrag = (e) => {
  cropDragMode = 'move'
  cropDragStart = getEventPos(e)
  cropSelectionStart = { ...cropSelection.value }
  document.addEventListener('mousemove', handleCropMouseMove)
  document.addEventListener('mouseup', handleCropMouseUp)
}

const startResize = (handle, e) => {
  cropDragMode = handle
  cropDragStart = getEventPos(e)
  cropSelectionStart = { ...cropSelection.value }
  document.addEventListener('mousemove', handleCropMouseMove)
  document.addEventListener('mouseup', handleCropMouseUp)
}

const handleCropMouseMove = (e) => {
  if (!cropDragMode || !cropDragStart) return

  const pos = getEventPos(e)
  const dx = pos.x - cropDragStart.x
  const dy = pos.y - cropDragStart.y
  const { width: imgW, height: imgH } = displayImageSize.value

  if (cropDragMode === 'move') {
    let newX = cropSelectionStart.x + dx
    let newY = cropSelectionStart.y + dy
    newX = Math.max(0, Math.min(newX, imgW - cropSelection.value.size))
    newY = Math.max(0, Math.min(newY, imgH - cropSelection.value.size))
    cropSelection.value.x = newX
    cropSelection.value.y = newY
  } else {
    let newSize = cropSelectionStart.size
    if (cropDragMode.includes('e')) newSize = cropSelectionStart.size + dx
    if (cropDragMode.includes('w')) newSize = cropSelectionStart.size - dx
    if (cropDragMode.includes('s')) newSize = cropSelectionStart.size + dy
    if (cropDragMode.includes('n')) newSize = cropSelectionStart.size - dy

    newSize = Math.max(30, Math.min(newSize, imgW, imgH))

    let newX = cropSelectionStart.x
    let newY = cropSelectionStart.y

    if (cropDragMode.includes('w')) newX = cropSelectionStart.x + (cropSelectionStart.size - newSize)
    if (cropDragMode.includes('n')) newY = cropSelectionStart.y + (cropSelectionStart.size - newSize)

    newX = Math.max(0, Math.min(newX, imgW - newSize))
    newY = Math.max(0, Math.min(newY, imgH - newSize))

    cropSelection.value = { x: newX, y: newY, size: newSize }
  }
}

const handleCropMouseUp = () => {
  cropDragMode = null
  cropDragStart = null
  cropSelectionStart = null
  document.removeEventListener('mousemove', handleCropMouseMove)
  document.removeEventListener('mouseup', handleCropMouseUp)
}

const closeCropDialog = () => {
  cropDialogVisible.value = false
  cropImageSrc.value = ''
  handleCropMouseUp()
}

const confirmCrop = async () => {
  try {
    cropping.value = true

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const outputSize = 300
    canvas.width = outputSize
    canvas.height = outputSize

    const img = cropImage.value
    const scale = 1 / imageScale.value

    const sx = cropSelection.value.x * scale
    const sy = cropSelection.value.y * scale
    const sSize = cropSelection.value.size * scale

    ctx.drawImage(
      img,
      sx, sy, sSize, sSize,
      0, 0, outputSize, outputSize
    )

    const dataUrl = canvas.toDataURL('image/png')
    const blob = await dataUrlToBlob(dataUrl)
    const croppedFile = new File([blob], 'avatar.png', { type: 'image/png' })

    await uploadFile(croppedFile)
  } catch (err) {
    console.error('裁剪失败:', err)
    uploadError.value = '处理图片失败，请重试'
  } finally {
    cropping.value = false
    closeCropDialog()
  }
}

const dataUrlToBlob = (dataUrl) => {
  return new Promise((resolve) => {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    resolve(new Blob([u8arr], { type: mime }))
  })
}

const uploadFile = async (file) => {
  uploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await uploadAvatar(formData)
    avatarUrl.value = response.data.url
  } catch (err) {
    uploadError.value = err.response?.data?.error || '上传失败，请稍后重试'
    console.error(err)
  } finally {
    uploading.value = false
  }
}

const removeAvatar = () => {
  avatarUrl.value = ''
}

const handleSubmit = async () => {
  if (!isValid.value) return

  submitting.value = true
  error.value = ''
  success.value = false

  try {
    await submitMessage(form.value.content, avatarUrl.value || null)
    success.value = true
    form.value.content = ''
    avatarUrl.value = ''
    emit('submitted')

    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (err) {
    error.value = err.response?.data?.error || '提交失败，请稍后重试'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  handleCropMouseUp()
})
</script>

<style scoped>
.message-form {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
}

.message-form h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.login-prompt {
  text-align: center;
  padding: 30px 20px;
  background: white;
  border-radius: 8px;
  border: 2px dashed #ddd;
}

.prompt-text {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 20px;
}

.prompt-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.prompt-btn {
  padding: 12px 28px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  font-size: 1rem;
  transition: all 0.2s;
  cursor: pointer;
}

.prompt-btn.login-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.prompt-btn.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.prompt-btn.register-btn {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.prompt-btn.register-btn:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
}

.avatar-upload-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 600;
}

.avatar-uploader {
  width: 140px;
  height: 140px;
  border: 2px dashed #d0d0d0;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
  position: relative;
}

.avatar-uploader:hover {
  border-color: #667eea;
  background: #f8f8ff;
}

.avatar-uploader.is-dragging {
  border-color: #667eea;
  background: #eef0ff;
  transform: scale(1.05);
}

.avatar-uploader.has-avatar {
  border-style: solid;
  border-color: #667eea;
}

.avatar-placeholder {
  text-align: center;
  color: #aaa;
  padding: 10px;
}

.avatar-placeholder svg {
  margin-bottom: 6px;
}

.upload-hint {
  font-size: 0.8rem;
  margin: 4px 0 2px;
  color: #888;
}

.upload-tip {
  font-size: 0.7rem;
  color: #bbb;
  margin: 0;
}

.avatar-preview-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(231, 76, 60, 0.9);
  color: white;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.2s;
}

.avatar-remove:hover {
  transform: scale(1.1);
  background: #e74c3c;
}

.hidden-input {
  display: none;
}

.avatar-error {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 8px;
}

.avatar-uploading {
  color: #667eea;
  font-size: 0.85rem;
  margin-top: 8px;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 600;
}

.input-with-badge {
  position: relative;
  display: flex;
  align-items: center;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s, box-shadow 0.3s;
  font-family: inherit;
}

.input-with-badge input {
  padding-right: 90px;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.disabled-input {
  color: #667eea;
  font-weight: 600;
}

.user-badge {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: #27ae60;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.char-count {
  position: absolute;
  right: 10px;
  bottom: -22px;
  font-size: 0.8rem;
  color: #999;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px 40px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  margin-top: 10px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-top: 15px;
  font-size: 0.9rem;
}

.success-message {
  color: #27ae60;
  margin-top: 15px;
  font-size: 0.9rem;
}

.crop-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.crop-dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 560px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.crop-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.crop-dialog-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.05rem;
}

.crop-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.crop-close-btn:hover {
  color: #333;
}

.crop-dialog-body {
  padding: 20px;
}

.crop-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 0 auto;
  background: #f5f5f5;
  user-select: none;
}

.crop-image {
  display: block;
  max-width: 100%;
  max-height: 400px;
  pointer-events: none;
}

.crop-selection {
  position: absolute;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
  cursor: move;
  box-sizing: border-box;
}

.crop-selection::before,
.crop-selection::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.5);
}

.crop-selection::before {
  left: 33%;
  right: 33%;
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.7);
  border-right: 1px solid rgba(255, 255, 255, 0.7);
}

.crop-selection::after {
  top: 33%;
  bottom: 33%;
  left: 0;
  right: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.7);
}

.crop-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid #667eea;
  border-radius: 2px;
}

.crop-handle-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.crop-handle-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.crop-handle-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.crop-handle-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.crop-tip {
  text-align: center;
  color: #888;
  font-size: 0.85rem;
  margin: 12px 0 0;
}

.crop-dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}

.cancel-btn {
  background: #e0e0e0;
  color: #666;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  margin-right: 8px;
  transition: background 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: #d0d0d0;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-reply-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.submit-reply-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-reply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
