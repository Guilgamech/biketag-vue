<template>
  <div>
    <!-- Button Group -->
    <div class="button-group">
      <!-- Left Button -->
      <bike-tag-button
        class="button-group__left"
        :text="$t('menu.biketags')"
        @click="goBikeTagsPage"
      />
      <!-- Middle Button -->
      <bike-tag-button
        class="button-group__middle"
        variant="bold"
        :text="$t('menu.play')"
        @click="goPlayPage"
      />
      <!-- Right Button -->
      <bike-tag-button class="button-group__right" :text="$t('menu.howto')" @click="goHowPage" />
    </div>
    <span
      v-if="getEasterEgg && playingEaster"
      class="fas fa-volume-mute"
      @click="muteEasterEgg"
    ></span>
    <audio id="biketag-jingle" ref="jingle">
      <source id="audioSource" :autoplay="playingEaster" type="audio/mpeg" :src="getEasterEgg" />
      {{ $t('pages.howto.browser_not_support_audio') }}
    </audio>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue'
import { mapGetters } from 'vuex'
import BikeTagButton from '@/components/BikeTagButton.vue'

export default defineComponent({
  name: 'BikeTagHeader',
  components: {
    BikeTagButton,
  },
  setup() {
    return {
      jingle: ref(null),
    }
  },
  data() {
    return {
      playingEaster: false,
    }
  },
  computed: {
    showAuth() {
      return false
    },
    ...mapGetters([
      'getGameTitle',
      'getCurrentBikeTag',
      'getQueuedTags',
      'getEasterEgg',
      'getMostRecentlyViewedTagnumber',
      'getGameName',
    ]),
  },
  methods: {
    playEasterEgg(e) {
      e.preventDefault()
      e.stopPropagation()
      if (this.getEasterEgg) {
        document.getElementById('biketag-jingle').play()
        this.playingEaster = true
      }
    },
    playingNow() {
      this.playingEaster = true
    },
    muteEasterEgg(e) {
      e.preventDefault()
      e.stopPropagation()
      if (this.playingEaster) {
        document.getElementById('jingle').pause()
        this.playingEaster = false
      }
    },
    goBikeTagsPage: function () {
      this.$router.push('/biketags')
    },
    goPlayPage: function () {
      this.$router.push('/play')
    },
    goHowPage: function () {
      this.$router.push('/howtoplay')
    },
  },
})
</script>
<style lang="scss" scoped>
.button-group {
  display: flex;
  align-items: center;
  justify-content: center;

  // &__left {
  // }

  &__middle {
    margin-left: 0.5rem;
  }

  &__right {
    margin-left: 0.5rem;
  }
}
</style>
