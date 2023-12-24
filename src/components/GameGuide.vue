<template>
  <div v-if="showMask" class="game-mask">
      <div class="message">请按下<span class="key">{{ textCompute.key }}</span>{{ textCompute.text }}</div>
  </div>
</template>

<script setup lang="ts">
import {defineProps, computed} from 'vue';
const props = defineProps({
  showMask: {type: Boolean, default: false},
  gameStatus: {type: String, default: 'ready'},
});
const keyMap: Record<string, any> = {
  ready: {
      key: 'P',
      text: '开始游戏',
  },
  end: {
      key: 'R',
      text: '重新开始游戏',
  },
};
const textCompute = computed(() => {
  return keyMap[props.gameStatus];
});
</script>

<style scoped>
.game-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, .6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.message {
  font-size: 24px;
  color: white;
  text-align: center;
}

.key {
  background-color: #3498db;
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
}
</style>
