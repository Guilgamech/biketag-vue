<template>
  <div class="container">
    <div class="player-list">
      <div v-for="player in playersList" :key="player.name" class="p-lg-1 p-md-1 mb-1">
        <player size="md" :player="player" />
      </div>
    </div>
  </div>
</template>
<script>
import { defineComponent } from 'vue'
import { mapGetters } from 'vuex'
import Player from '@/components/PlayerBicon.vue'

export default defineComponent({
  name: 'LeaderboardView',
  components: {
    Player,
  },
  computed: {
    ...mapGetters(['getLeaderboard']),
    playersList() {
      return this.getLeaderboard
    },
  },
})
</script>
<style lang="scss" scoped>
.player-list {
  @media (min-width: 1200px) {
    margin-top: 13em;
  }
}
</style>
