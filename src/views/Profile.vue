<template>
  <loading v-if="tagsAreLoading" v-model:active="tagsAreLoading" :is-full-page="true">
    <img class="spinner" src="@/assets/images/SpinningBikeV1.svg" />
  </loading>
  <b-modal
    v-if="profile?.user_metadata && profile.user_metadata?.name?.length > 0"
    v-model="showModal"
    title="User Name"
    hide-footer
    hide-header
  >
    <img class="close-btn" src="@/assets/images/close.svg" @click="hideModal" />
    <form @submit.prevent="onSubmitName">
      <div class="mt-3">
        <bike-tag-input
          v-model="profile.user_metadata.name"
          :placeholder="profile.user_metadata.name || $t('pages.profile.set_name_placeholder')"
        />
        <bike-tag-button
          class="modal-header"
          variant="medium"
          :text="$t('pages.profile.set_name')"
        />
      </div>
    </form>
  </b-modal>
  <div v-if="profile?.user_metadata" class="container mb-5 mt-5">
    <div class="center-container">
      <div v-if="player.tags" class="d-flex justify-content-center mt-5 mb-5">
        <player size="lg" :player="player" :no-link="true" />
      </div>
      <div v-else class="profile-picture">
        <img class="player-avatar" :src="profile?.picture" :alt="profile?.name" />
        <div class="picture-outline">
          <bike-tag-button variant="circle-clean"> </bike-tag-button>
        </div>
      </div>
      <div class="flx-columns mt-5">
        <div>
          <span
            v-for="(social, i) in Object.keys(profile?.user_metadata).filter(
              (key) =>
                profile?.user_metadata[key] != null &&
                profile?.user_metadata[key].length > 0 &&
                key != 'passcode'
            )"
            :key="`${i}_label`"
            class="player-name mt-4"
            style="font-size: 2.5rem"
          >
            {{ profile?.user_metadata[social] }}
          </span>
        </div>
      </div>
    </div>
    <div class="container mt-5 col-md-8 col-lg-8">
      <form
        class="mt-5 mb-2"
        name="profile-update"
        action="profile-update"
        method="POST"
        @submit.prevent="onSubmit"
      >
        <div v-if="profile.user_metadata" class="mt-3">
          <bike-tag-input
            v-model="profile.user_metadata.name"
            :label="$t('pages.profile.name')"
            readonly
          />
        </div>
        <div v-if="profile" class="mt-3">
          <bike-tag-input v-model="profile.email" :label="$t('pages.profile.email')" readonly />
        </div>
        <div v-if="profile.user_metadata" class="mt-3">
          <bike-tag-input
            id="passcode"
            v-model="profile.user_metadata.passcode"
            label="Passcode"
            minlength="3"
            maxlength="30"
          />
        </div>
        <div v-for="(social, i) in socialNetworkIcons" :key="`${i}_inputs`" class="mt-3 input-icon">
          <bike-tag-input
            :id="social[0]"
            v-model="profile.user_metadata.social[social[0]]"
            :label="splitCamelCase(social[0])"
            :placeholder="
              (profile?.user_metadata?.length > i && profile?.user_metadata[i]) ||
              `${social[0].charAt(0).toUpperCase() + social[0].slice(1)} player name`
            "
          >
            <div class="icon-container">
              <img :id="social[0]" class="icon" :src="social[1]" />
            </div>
          </bike-tag-input>
        </div>
        <template v-if="isBikeTagAmbassador">
          <template
            v-for="(credential, i) in Object.keys(profile.user_metadata.credentials)"
            :key="`${i}_config`"
          >
            <bike-tag-button
              variant="medium"
              :text="`${firstToUperCase(credential)} Configuration`"
              @click.prevent="() => toggleShowFields(credential)"
            />
            <div :ref="credential" class="input-block mt-3 hide">
              <bike-tag-input
                v-for="(inputField, j) in Object.keys(
                  profile.user_metadata.credentials[credential]
                )"
                :key="`${j}_config_ipnuts`"
                v-model="profile.user_metadata.credentials[credential][inputField]"
                :label="splitCamelCase(inputField)"
                :placeholder="`${firstToUperCase(credential)} ${splitCamelCase(inputField)}`"
                type="password"
              />
            </div>
          </template>
        </template>
        <div class="m-2">
          <h2 style="text-align: left">Options</h2>
          <hr :style="`background-image: url(${styledHr})`" />
          <form @submit="updateOptions">
            <template v-if="profile.user_metadata">
              <bike-tag-input
                id="skip-steps"
                v-model="profile.user_metadata.options.skipSteps"
                type="checkbox"
                label="Skip steps"
                variant="checkbox"
              />
            </template>
          </form>
        </div>
        <bike-tag-button variant="medium" :text="$t('pages.profile.save')" />
      </form>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { mapGetters } from 'vuex'
import BikeTagButton from '@/components/BikeTagButton.vue'
import BikeTagInput from '@/components/BikeTagInput.vue'
import Loading from 'vue-loading-overlay'
import 'vue-loading-overlay/dist/vue-loading.css'
import Reddit from '@/assets/images/Reddit.svg'
import Instagram from '@/assets/images/Instagram.svg'
import Twitter from '@/assets/images/Twitter.svg'
import Imgur from '@/assets/images/Imgur.svg'
import Discord from '@/assets/images/Discord.svg'
import Player from '@/components/PlayerBicon.vue'
import StyledHr from '@/assets/images/hr.svg'

export default defineComponent({
  name: 'ProfileView',
  components: {
    Loading,
    BikeTagButton,
    BikeTagInput,
    Player,
  },
  data() {
    return {
      profile: this.getProfile,
      socialNetworkIcons: [
        ['reddit', Reddit],
        ['instagram', Instagram],
        ['twitter', Twitter],
        ['imgur', Imgur],
        ['discord', Discord],
      ],
      showModal: false,
      styledHr: StyledHr,
    }
  },
  computed: {
    ...mapGetters(['getPlayers', 'getProfile', 'isBikeTagAmbassador']),
    player() {
      const playerList = this.getPlayers?.filter((player) => {
        return this.$auth.user.name === decodeURIComponent(encodeURIComponent(player.name))
      })
      if (playerList && playerList.length > 0) {
        return playerList[0]
      }

      return {}
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.profile = this.getProfile
      this.profile.user_metadata = this.profile.user_metadata ?? { social: {} }
      this.profile.user_metadata.options = this.profile.user_metadata.options ?? {
        skipSteps: false,
      }
      this.showModal =
        this.profile?.user_metadata?.name != null && !this.profile?.user_metadata?.name.length
      switch (this.profile.sub.toLowerCase().replace('oauth2|', '').split('|')[0]) {
        case 'reddit':
          if (!this.profile.user_metadata.social?.reddit) {
            this.profile.user_metadata.social.reddit = this.profile.name
          }
          break
        case 'imgur':
          if (!this.profile.user_metadata.social?.imgur) {
            this.profile.user_metadata.social.imgur = this.profile.name
          }
          break
        case 'twitter':
          if (!this.profile.user_metadata.social?.twitter) {
            this.profile.user_metadata.social.twitter = this.profile.name
          }
          break
      }
    })
  },
  methods: {
    hideModal() {
      this.showModal = false
    },
    firstToUperCase(str) {
      return str[0].charAt(0).toUpperCase() + str.slice(1)
    },
    splitCamelCase(str) {
      return this.firstToUperCase(str).replace(/([a-z])([A-Z])/g, '$1 $2')
    },
    toggleShowFields(name) {
      this.$refs[name][0].classList.toggle('hide')
    },
    async onSubmitName() {
      if (this.profile.user_metadata.name.length > 0) {
        this.profile['token'] = (await this.$auth.getIdTokenClaims()).__raw
        try {
          await this.$store.dispatch('assignName', this.profile)
          this.profile = this.getProfile
          this.$toast.open({
            message: 'Success',
            type: 'success',
            position: 'top',
          })
        } catch (e) {
          this.$toast.open({
            message: e.response?.data ?? e.message,
            type: 'error',
            position: 'top',
          })
        }
        this.showModal = false
      }
    },
    async onSubmit() {
      const claims = await this.$auth.getIdTokenClaims()
      if (claims) {
        this.profile['token'] = claims.__raw
        try {
          await this.$store.dispatch('updateProfile', this.profile)
          this.$toast.open({
            message: 'Success',
            type: 'success',
            position: 'top',
          })
        } catch (e) {
          this.$toast.open({
            message: e.response?.data ?? e.message,
            type: 'error',
            position: 'top',
          })
        }
      }
    },
  },
})
</script>
<style lang="scss">
.flx-columns {
  @include flx-center($flow: column nowrap, $al: flex-start);

  .biketag-button {
    .biketag-text__inner {
      font-size: 1.5rem !important;
    }
  }
}

.input-block {
  .biketag-button {
    .biketag-text__inner {
      font-size: 1.5rem !important;
    }
  }
}

.input-icon {
  .biketag-input {
    input {
      z-index: 2;

      &:focus {
        background-color: transparent !important;
      }
    }
  }
}
</style>
<style lang="scss" scoped>
.icon-container {
  width: 100%;
  justify-content: flex-end;
  display: flex;
  position: absolute;
  top: 30%;
  padding-right: 1.5rem;

  #imgur {
    margin-top: 0.5rem;
  }

  .icon {
    max-width: 40px;
    z-index: 1;
  }
}

hr {
  height: 13px;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100%;
}

.center-container {
  @include flx-center($flow: column nowrap);

  max-width: 800px;
  margin: auto;

  @media (min-width: 600px) {
    flex-flow: row nowrap;

    .player-name {
      margin-top: 0;
    }
  }

  .profile-picture {
    position: relative;
    width: 185px;

    .picture-outline {
      width: 185px;
      height: 190px;
      position: absolute;
      top: -1rem;
      left: 0;

      .biketag-button {
        width: inherit;
        height: inherit;
      }
    }

    img {
      position: relative;
    }
  }

  .player-avatar {
    clip-path: circle(50%);
    min-width: 150px;
  }

  .player-name {
    animation: fadein 2s;
  }
}

.hide {
  display: none;
}

.modal-header {
  margin: auto;
}

.close-btn,
.go-queue {
  cursor: pointer;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
}
</style>
