<template>
  <div v-if="isShow" class="toast">
      {{ msg }}
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineProps, defineEmits} from 'vue';
const props = defineProps({
  show: {
      type: Boolean,
      default: false,
  },
  msg: {
      type: String,
      default: 'message',
  },
  duration: {
      type: Number,
      default: 1500,
  },
});

const isShow = ref(props.show);
const emit = defineEmits(['update:show']);
let timer: any;

watch(
  () => props.show,
  (newVal, oldVal) => {
      isShow.value = newVal;
      if (newVal) {
          clearInterval(timer);
          timer = setTimeout(() => {
              isShow.value = false;
              emit('update:show', false);
          }, props.duration);
      }
  }
);
</script>

<style scoped>
.toast {
  position: fixed;
  top: 200px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, .8);
  font-size: 24px;
  border-radius: 4px;
  color: white;
}
</style>
