<template>
  <div class="score_container">
      <div class="score_panel">
          <div>
              <span style="font-weight: 700;">分数:{{ score }}</span>
          </div>
          <div>
              <span style="font-weight: 700;">金币数:{{ coin }}</span>
          </div>
          <div>
              <span style="font-weight: 700;">错误次数:{{ mistake }}</span>
          </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import {defineProps} from 'vue';
const props = defineProps({
  score: {type: Number, default: 0},
  coin: {type: Number, default: 0},
  mistake: {type: Number, default: 0},
});
</script>

<style scoped>
.score_container {
  width: 100vw;
  height: 100vh;
  position: relative;
  z-index: 999;
}

.score_panel {
  height: 100px;
  width: 300px;
  position: absolute;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #333;
  color: #fff;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, .3);
}
</style>
