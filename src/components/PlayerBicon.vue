<template>
  <div
    v-if="_playerName?.length"
    :class="'player-wrapper mt-5 avatar-' + size"
    role="button"
    @click="goPlayerPage"
  >
    <div>
      <svg class="svg">
        <clipPath id="badge-clip" clipPathUnits="objectBoundingBox">
          <path
            d="M0,0.051 v0.572 c0,0.025,0.019,0.064,0.05,0.083 l0.404,0.28 c0.025,0.019,0.068,0.019,0.093,0 l0.404,-0.28 c0.025,-0.019,0.05,-0.057,0.05,-0.083 v-0.572 C0.994,0.019,0.963,0,0.925,0 H0.068 C0.031,0,0,0.019,0,0.051 L0,0.051"
          ></path>
        </clipPath>
      </svg>
      <div class="clipped"></div>
      <span
        v-if="player?.tags?.length"
        :class="`tag-count tag-count--color-${tagColorNumber(player.tags.length)}`"
        >{{ getTagCount }}</span
      >
    </div>
    <img v-if="playerBiconUrl" class="player-bicon" :src="playerBiconUrl" :alt="_playerName" />
    <span class="player-name p-1">{{ _playerName }}</span>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { mapGetters } from 'vuex'

export default defineComponent({
  name: 'PlayerBicon',
  props: {
    size: {
      type: String,
      default: 'md',
    },
    player: {
      type: Object,
      default: () => {
        return {}
      },
    },
    playerName: {
      type: String,
      default: null,
    },
    noLink: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapGetters(['getImgurImageSized']),
    _playerName() {
      if (this.playerName) {
        return this.playerName
      }
      if (this.size === 'sm') {
        return this.player?.name.substr(0, 1)
      } else {
        return this.player?.name
      }
    },
    playerBiconUrl() {
      let url
      if (this.player && typeof this.player === 'object') {
        if (this.player.bicon) {
          url = this.player.bicon
        } else if (this.player.tags[this.player.tags.length - 1].mysteryImageUrl) {
          url = this.player.tags[this.player.tags.length - 1].mysteryImageUrl
        } else {
          url = this.player.tags[this.player.tags.length - 1].foundImageUrl
        }
      }
      return this.getImgurImageSized(url, this.size[0])
    },
    getTagCount() {
      if (this.size === 'lg') {
        return this.player.tags.length
      }
      return this.player.tags.length > 99 ? '+99' : this.player.tags.length
    },
  },
  methods: {
    goPlayerPage: function () {
      if (!this.noLink) {
        this.$router.push('/player/' + encodeURIComponent(this.player?.name))
      }
    },
    tagColorNumber(count) {
      if (count === 1) {
        return 'one'
      } else if (count < 10) {
        return 'lessthanten'
      } else if (count > 49 && count < 100) {
        return 'fiftyormore'
      } else if (count > 100 && count < 500) {
        return 'onehundredormore'
      } else {
        return 'fivehundredormore'
      }
    },
  },
})
</script>
<style scoped lang="scss">
.player-wrapper {
  position: relative;
  padding-top: 2rem;

  .player-name {
    z-index: 99;
    transform: rotate(-8deg);
    display: block;
    animation: fadein 2s;
    word-break: break-all;

    // word-break: break-word;
    // text-decoration-line: underline;
  }

  .svg {
    position: absolute;
    width: 0;
    height: 0;
  }

  .tag-count {
    position: absolute;
    padding: 10px 0;
    min-width: 4rem;
    text-align: center;
    clip-path: url('#badge-clip');
    z-index: 99;
  }

  .tag-count--color-one {
    background-color: rgb(228 178 13 / 90%);
  }

  .tag-count--color-lessthanten {
    background-color: rgb(26 228 13 / 90%);
  }

  .tag-count--color-fiftyormore {
    background-color: rgb(31 13 228 / 90%);
  }

  .tag-count--color-onehundredormore {
    background-color: rgb(228 13 219 / 90%);
  }

  .tag-count--color-fivehundredormore {
    background-color: rgb(228 13 31 / 87%);
  }
}

.avatar-txt {
  .tag-count {
    display: none;
    padding: 0;
    width: 1.75em;
    font-size: 0.5em;
  }

  .player-bicon {
    display: none;
  }
}

.avatar-sm {
  .player-bicon {
    width: 8rem;
    height: 8rem;
    clip-path: circle(50%);
  }

  .player-name {
    font-size: 3.5vh;
    bottom: 1rem;
    top: auto;
  }

  .tag-count {
    font-size: 2.5vh;
    top: 43%;
    right: 5px;
  }
}

.avatar-md {
  .player-bicon {
    width: 10rem;
    height: 10rem;
    clip-path: circle(50%);
  }

  .player-name {
    font-size: 1.5rem;
    bottom: 0;
    right: -22%;
    top: auto;
  }

  .tag-count {
    font-size: 1.5rem;
    width: 3.5rem;
    left: 55%;
    top: 15%;
  }

  @media (min-width: 1024px) {
    .tag-count {
      left: 52%;
    }
  }
}

.avatar-lg {
  .player-bicon {
    border-radius: 5%;
    max-width: 90vw;
  }

  .player-name {
    position: absolute;
    top: -5%;
    left: 0;
    right: 0;
    transform: unset;
    font-size: 2rem;
  }

  .tag-count {
    font-size: 2rem;
    top: 2rem;
    right: 1rem;
    padding: 2px 8px;
  }
}

.player-tags {
  .tag-player {
    display: none;
  }
}
</style>
