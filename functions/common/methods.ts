import request from 'request'
import { getDomainInfo } from '../../src/common/utils'
import md5 from 'md5'
import qs from 'qs'
import crypto from 'crypto'
import CryptoJS from 'crypto-js'
import nodemailer from 'nodemailer'
import { Liquid } from 'liquidjs'
import { join, extname } from 'path'
import { readFileSync } from 'fs'
import { Ambassador, Game, Tag } from 'biketag/lib/common/schema'
import { activeQueue, BackgroundProcessResults } from './types'
import { JwtVerifier, getTokenFromHeader } from '@serverless-jwt/jwt-verifier'
import BikeTagClient from 'biketag'
import axios from 'axios'
import Ajv from 'ajv'
import * as jose from 'jose'
import { BikeTagProfile } from '../../src/common/types'
import lzutf8 from 'lzutf8'

const ajv = new Ajv()
export const getBikeTagHash = (val: string): string => md5(`${val}${process.env.HOST_KEY}`)
export const getBikeTagClientOpts = (
  req?: request.Request,
  authorized?: boolean,
  admin?: boolean
) => {
  const domainInfo = getDomainInfo(req)
  const isAuthenticatedPOST = req?.method === 'POST' || authorized
  const isGET = !isAuthenticatedPOST && req?.method === 'GET'
  const opts: any = {
    game: domainInfo.subdomain ?? process.env.GAME_NAME,
    cached: isGET || !isAuthenticatedPOST,
    accessToken: process.env.ACCESS_TOKEN,
    imgur: {
      clientId: process.env.I_CID,
    },
  }

  if (authorized) {
    opts.imgur = opts.imgur ?? {}
    opts.imgur.clientSecret = process.env.I_CSECRET
    opts.imgur.accessToken = process.env.I_TOKEN
    opts.imgur.refreshToken = process.env.I_RTOKEN

    // opts.reddit = opts.reddit ?? {}
    // opts.reddit.clientId = process.env.R_CID
    // opts.reddit.clientSecret = process.env.R_CSECRET
    /// TODO: comes from sanity game settings
    // opts.reddit.username = process.env.R_UNAME
    // opts.reddit.password = process.env.R_PASS

    opts.sanity = opts.sanity ?? {}
    opts.sanity.projectId = process.env.S_PID
    opts.sanity.dataset = process.env.S_DSET
    opts.sanity.token = process.env.S_TOKEN

    if (admin) {
      opts.imgur.clientId = process.env.IA_CID?.length ? process.env.IA_CID : opts.imgur.clientId
      opts.imgur.clientSecret = process.env.IA_CSECRET?.length
        ? process.env.IA_CSECRET
        : opts.imgur.clientSecret
      opts.imgur.accessToken = process.env.IA_TOKEN ?? ''
      opts.imgur.refreshToken = process.env.IA_RTOKEN ?? opts.imgur.refreshToken

      opts.sanity = opts.sanity ?? {}
      opts.sanity.projectId = process.env.SA_PID
      opts.sanity.dataset = process.env.SA_DSET
      opts.sanity.token = process.env.SA_TOKEN

      // opts.reddit.clientId = process.env.RA_CID
      // opts.reddit.clientSecret = process.env.RA_CSECRET
      // opts.reddit.username = process.env.RA_UNAME
      // opts.reddit.password = process.env.RA_PASS
    }
  }

  return opts
}

export const parseQuery = (query = '') => {
  const params: any = new URLSearchParams(query) ?? []
  return Object.fromEntries(params)
}

export const parseBody = (body = '') => {
  let parsed = {}
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    parsed = parseQuery(body)
  }

  return parsed
}

export const getPayloadOpts = (event: any, base = {}): any => {
  const parsedQuery = parseQuery(event.rawQuery)
  const parsedBody = parseBody(event.body)
  return {
    ...base,
    ...parsedQuery,
    ...parsedBody,
  }
}

export const isValidJson = (data, type = 'none') => {
  let schema = {}

  switch (type) {
    case 'profile.patch':
      schema = {
        type: 'object',
        properties: {
          user_metadata: {
            type: 'object',
            properties: {
              passcode: { type: 'string' },
              options: {
                type: 'object',
                properties: {
                  skipSteps: { type: 'boolean' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
              social: {
                type: 'object',
                properties: {
                  reddit: { type: 'string' },
                  instagram: { type: 'string' },
                  twitter: { type: 'string' },
                  imgur: { type: 'string' },
                  discord: { type: 'string' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
            },
            minProperties: 1,
            additionalProperties: false,
          },
        },
        required: ['user_metadata'],
        additionalProperties: false,
      }
      break
    case 'profile.patch.ambassador':
      schema = {
        type: 'object',
        properties: {
          user_metadata: {
            type: 'object',
            properties: {
              name: {type: 'string'},
              passcode: { type: 'string' },
              options: {
                type: 'object',
                properties: {
                  skipSteps: { type: 'boolean' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
              social: {
                type: 'object',
                properties: {
                  reddit: { type: 'string' },
                  instagram: { type: 'string' },
                  twitter: { type: 'string' },
                  imgur: { type: 'string' },
                  discord: { type: 'string' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
              credentials: {
                type: 'object',
                properties: {
                  imgur: {
                    type: 'object',
                    properties: {
                      clientId: { type: 'string' },
                      clientSecret: { type: 'string' },
                      refreshToken: { type: 'string' },
                    },
                    additionalProperties: false,
                  },
                  sanity: {
                    type: 'object',
                    properties: {
                      projectId: { type: 'string' },
                      dataset: { type: 'string' },
                    },
                    additionalProperties: false,
                  },
                  reddit: {
                    type: 'object',
                    properties: {
                      clientId: { type: 'string' },
                      clientSecret: { type: 'string' },
                      username: { type: 'string' },
                      password: { type: 'string' },
                    },
                    additionalProperties: false,
                  },
                },
                additionalProperties: false,
              },
            },
            minProperties: 1,
            additionalProperties: false,
          },
        },
        required: ['user_metadata'],
        additionalProperties: false,
      }
      break
    case 'profile.put':
      schema = {
        type: 'object',
        properties: {
          user_metadata: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
        required: ['user_metadata'],
        additionalProperties: false,
      }
      break
  }

  const validate = ajv.compile(schema)

  return validate(data)
}

interface Event {
  headers: Record<string, unknown>
}

export interface IdentityContext {
  /**
   * The token that was provided.
   */
  token: string

  /**
   * Claims for the authenticated user.
   */
  claims: Record<string, unknown>
}

/// For netlify identity JWT decoding
const validateJWT = (verifier: JwtVerifier, options: any) => {
  return (handler: any) => async (event: Event, context: any, cb: any) => {
    let claims
    let accessToken

    try {
      accessToken = getTokenFromHeader(event.headers.authorization as string)
      claims = await verifier.verifyAccessToken(accessToken)
    } catch (err) {
      if (typeof options.handleError !== 'undefined' && options.handleError !== null) {
        return options.handleError(err)
      }

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: err.code,
          error_description: err.message,
        }),
      }
    }

    // Expose the identity in the client context.
    const ctx: IdentityContext = {
      token: accessToken,
      claims,
    }
    context.identityContext = ctx

    // Continue.
    return handler(event, context, cb)
  }
}

export const getThisGamesAmbassadors = async (client: BikeTagClient, adminBikeTagOpts?: any) => {
  if (!client) {
    adminBikeTagOpts =
      adminBikeTagOpts ??
      getBikeTagClientOpts(
        {
          method: 'get',
        } as unknown as request.Request,
        true,
        true
      )
  }
  client = client ?? new BikeTagClient(adminBikeTagOpts)
  const thisGamesAmbassadors = await client.ambassadors(undefined, {
    source: 'sanity',
  })

  return thisGamesAmbassadors
}

export const getProfileAuthorization = async (event: any): Promise<any> => {
  const authorization = await getPayloadAuthorization(event)
  let profile: any = authorization

  if (authorization) {
    const biketagOpts = getBikeTagClientOpts(event, true, true)
    const biketag = new BikeTagClient(biketagOpts)
    const thisGamesAmbassadors = (await getThisGamesAmbassadors(biketag)) as Ambassador[]
    const profileAmbassadorMatch = thisGamesAmbassadors.filter((a) => a.email === profile.email)

    if (profileAmbassadorMatch.length) {
      profile.isBikeTagAmbassador = true
      profile = { ...profile, ...profileAmbassadorMatch[0] }
    }
  }

  /// TODO: pear down this object to only the things we care about
  return profile
}

export const getPayloadAuthorization = async (event: any): Promise<any> => {
  let authorizationString = event.headers.authorization
  const basic = 'Basic '
  const bearer = 'Bearer '
  const client = 'Client-ID '

  const authorizationType: string =
    authorizationString?.indexOf(basic) === 0
      ? 'basic'
      : authorizationString?.indexOf(client) === 0
      ? 'client'
      : authorizationString?.indexOf(bearer) === 0
      ? 'bearer'
      : null

  const getBasicAuthProfile = (authorizationString: string) => {
    /// Basic Auth: "Basic [name]::[password]""
    // console.log('basic', { authorizationString })
    const namePasscodeString = CryptoJS.AES.decrypt(
      authorizationString,
      process.env.HOST_KEY
    ).toString(CryptoJS.enc.Utf8)
    const namePasscodeSplit = namePasscodeString.split('::')
    return {
      name: namePasscodeSplit[0],
      passcode: namePasscodeSplit[1],
    }
  }

  const getNetlifyAuthProfile = async (authorizationString: string) => {
    // console.log('netlify', { authorizationString })
    try {
      const verifierOpts = { issuer: '', audience: '' }
      const verifier = new JwtVerifier(verifierOpts)
      return await validateJWT(verifier, verifierOpts)
    } catch (e) {
      console.error({ authorizationNetlifyValidationError: e })
    }
    return null
  }

  const getAuth0AuthProfile = async (authorizationString: string) => {
    // console.log('auth0', { authorizationString })
    try {
      const JWKS = jose.createRemoteJWKSet(
        new URL(`https://${process.env.A_DOMAIN}/.well-known/jwks.json`)
      )

      const { payload } = await jose.jwtVerify(authorizationString, JWKS)
      return payload
    } catch (e) {
      /// Swallow error
      // console.error({ authorizationAuth0ValidationError: e })
      return authorizationString
    }
  }

  /// DEBUG: uncomment to check incoming authorization credentials
  // console.log({ orign: event.headers.authorization, authorizationType, authorizationString })

  switch (authorizationType) {
    case 'basic':
      authorizationString = authorizationString.substring(basic.length)
      return getBasicAuthProfile(authorizationString)
    case 'netlify':
      authorizationString = authorizationString.substring(client.length)
      return getNetlifyAuthProfile(authorizationString)
    case 'client':
      authorizationString = authorizationString.substring(client.length)
      return getAuth0AuthProfile(authorizationString)
    case 'bearer':
      authorizationString = authorizationString.substring(bearer.length)
      return getAuth0AuthProfile(authorizationString)
    default:
      authorizationString = authorizationString?.length
        ? 'authorization type not supported'
        : authorizationString
      break
  }

  return null
}

export const defaultLogo = '/images/BikeTag.svg'

const noKey = 'BikeTag'
export const createMd5 = (text: string): Buffer => {
  return crypto.createHash('md5').update(text).digest()
}

export const encrypt = (t: any, key?: string) => {
  try {
    t = typeof t !== 'string' ? JSON.stringify(t) : t
    const secretKey = key ?? process.env.HOST_KEY ?? noKey

    let encryptedKey = createMd5(secretKey)
    encryptedKey = Buffer.concat([encryptedKey, encryptedKey.slice(0, 8)]) // properly expand 3DES key from 128 bit to 192 bit

    const cipher = crypto.createCipheriv('des-ede3', encryptedKey, '')
    const encrypted = cipher.update(t, 'utf8', 'base64')

    return encrypted + cipher.final('base64')
  } catch (e) {
    /// swallow exception
    return null
  }
}

export const decrypt = (encryptedBase64: string, key?: string) => {
  try {
    const secretKey = key ?? process.env.HOST_KEY ?? noKey
    let encryptedKey = createMd5(secretKey)
    encryptedKey = Buffer.concat([encryptedKey, encryptedKey.slice(0, 8)]) // properly expand 3DES key from 128 bit to 192 bit
    const decipher = crypto.createDecipheriv('des-ede3', encryptedKey, '')
    let decrypted: any = decipher.update(encryptedBase64, 'base64')
    decrypted += decipher.final()

    const jsonObject = JSON.parse(decrypted)

    return jsonObject || decrypted
  } catch (e) {
    /// swallow exception
    console.log(e)
    return null
  }
}

export const compress = lzutf8.compress
export const decompress = lzutf8.decompress

export const sendEmail = async (to: string, subject: string, locals: any, template?: string) => {
  template = template ?? subject
  const liquidOpts = {
    dynamicPartials: true,
    strict_filters: true,
    extname: '.liquid',
    // root: [join('functions', 'emails')],
    customFilters: {
      biketag_image: (url = '', size = '') => {
        const ext = extname(url)
        /// Make sure the image type is supported
        if (['.jpg', '.jpeg', '.png', '.bmp'].indexOf(ext) === -1) return url

        switch (size) {
          default:
          case 'original':
          case '':
            break

          case 's':
          case 'm':
          case 'small':
          case 'medium':
            size = 's'
            break

          case 'l':
          case 'large':
            size = 'l'
            break
        }

        return url.replace(ext, `${size}${ext}`)
      },
    },
  }
  let html = ''
  let text = ''

  const liquid = new Liquid(liquidOpts)

  Object.keys(liquidOpts.customFilters).forEach((filter) => {
    const filterMethod = liquidOpts.customFilters[filter]
    liquid.registerFilter(filter, filterMethod)
  })
  const templateFilePath = join('functions', 'emails', template)
  const htmlTemplateFilePath = `${templateFilePath}.liquid`
  const textTemplateFilePath = `${templateFilePath}--text.liquid`

  try {
    // if (existsSync(htmlTemplateFilePath)) {
    const htmlTemplate = readFileSync(htmlTemplateFilePath).toString()
    html = liquid.parseAndRenderSync(htmlTemplate, locals)
    // }
    // if (existsSync(textTemplateFilePath)) {
    const textTemplate = readFileSync(textTemplateFilePath).toString()
    text = liquid.parseAndRenderSync(textTemplate, locals)
    // }
  } catch (e) {
    console.log({ e })
  }

  if (!html.length) {
    console.log({ templateFilePath, htmlTemplateFilePath })
  }

  const emailOpts = {
    from: process.env.G_EMAIL, // sender address
    to, // list of receivers
    subject, // subject
    text, // plain text body
    html, // html body
  }

  const transporterOpts: any = {
    auth: {
      user: process.env.G_EMAIL,
      pass: process.env.G_PASS,
    },
    service: 'gmail',
  }

  const transporter = nodemailer.createTransport(transporterOpts)

  const info = await transporter.sendMail(emailOpts)

  /// TODO: formulate the response into something usable
  return info
}

export const getEncodedExpiry = (data = {}, days = 2) => {
  const expiryData = {
    ...data,
    expiry: new Date(
      /// Expiry is now plus  Ms     s    h    days  x (default 2)
      new Date().getTime() + 1000 * 60 * 60 * 24 * days
    ),
  }
  return encodeURIComponent(encrypt(expiryData))
}

export const sendEmailsToAmbassadors = async (
  emailName: string,
  emailSubject: string,
  ambassadors: Ambassador[],
  getEmailData: (a?: Ambassador) => any,
  sendToSuperAdmin = true
): Promise<{ accepted: any[]; rejected: any[] }> => {
  let emailSent
  let accepted = []
  let rejected = []
  const defaultEmailData = {
    host: 'eh?',
    subdomainIcon: '/images/BikeTag.svg',
  }

  for (const ambassador of ambassadors) {
    if (ambassador.email) {
      console.log(`sending ${emailName} ambassador email to: ${ambassador.email}`)
      emailSent = await sendEmail(
        ambassador.email,
        emailSubject,
        {
          ...defaultEmailData,
          ...getEmailData(ambassador),
        },
        emailName
      )
      accepted = accepted.concat(emailSent.accepted)
      rejected = rejected.concat(emailSent.rejected)
    }
  }
  if (sendToSuperAdmin) {
    const superAdmin = process.env.ADMIN ?? ''
    if (superAdmin?.length) {
      console.log(`sending ${emailName} superAdmin email to: ${superAdmin}`)
      emailSent = await sendEmail(
        superAdmin,
        emailSubject,
        {
          ...defaultEmailData,
          ...getEmailData({ id: superAdmin } as unknown as Ambassador),
        },
        emailName
      )
      accepted = accepted.concat(emailSent.accepted)
      rejected = rejected.concat(emailSent.rejected)
    }
  }

  return { accepted, rejected }
}

export const getSanityImageUrl = (
  logo: string,
  size = '',
  sanityBaseCDNUrl = 'https://cdn.sanity.io/images/x37ikhvs/production/'
) => {
  const properFilePath = logo.replace('image-', '').replace('-png', '.png').replace('-jpg', '.jpg')
  return `${sanityBaseCDNUrl}${properFilePath}${size.length ? `?${size}` : ''}`
}

export const archiveAndClearQueue = async (
  queuedTags: Tag[],
  game?: Game
): Promise<BackgroundProcessResults> => {
  const results = []
  let errors = false
  const biketagOpts = getBikeTagClientOpts(
    { method: 'get' } as unknown as request.Request,
    true,
    true
  )
  const biketag = new BikeTagClient(biketagOpts)
  if (!game) {
    const gameResponse = await biketag.getGame({ game: queuedTags[0].game }, { source: 'sanity' })
    game = gameResponse.success ? gameResponse.data : null
  }
  if (queuedTags.length && game) {
    const nonAdminBikeTagOpts = getBikeTagClientOpts(
      { method: 'get' } as unknown as request.Request,
      true
    )
    const gameName = game.name.toLocaleLowerCase()
    console.log('archiving remaining queued tags', { game: gameName, queuedTags })
    nonAdminBikeTagOpts.game = gameName
    nonAdminBikeTagOpts.imgur.hash = game.queuehash
    const nonAdminBikeTag = new BikeTagClient(nonAdminBikeTagOpts)

    for (const nonWinningTag of queuedTags) {
      /* Archive using ambassador credentials (mainhash and archivehash are both ambassador albums) */
      const archiveTagResult = await biketag.archiveTag({
        ...nonWinningTag,
        archivehash: game.archivehash,
      })
      if (archiveTagResult.success) {
        results.push({
          message: 'non-winning found image archived',
          game: gameName,
          tag: nonWinningTag,
        })
      } else {
        console.log({ archiveTagResult })
        results.push({
          message: 'error archiving non-winning found image',
          game: gameName,
          tag: nonWinningTag,
        })
        errors = true
      }
      /* delete using player credentials (queuehash is player album) */
      const deleteArchivedTagFromQueueResult = await nonAdminBikeTag.deleteTag(nonWinningTag)
      if (deleteArchivedTagFromQueueResult.success) {
        results.push({
          message: 'non-winning tag deleted from queue',
          game: gameName,
          tag: nonWinningTag,
        })
      } else {
        console.log({ deleteArchivedTagFromQueueResult })
        results.push({
          message: 'error deleting non-winning tag from the queue',
          game: gameName,
          tag: nonWinningTag,
        })
        /// No error here?
      }
    }
  }

  return {
    results,
    errors,
  }
}

export const getActiveQueueForGame = async (
  game: Game,
  adminBikeTagOpts?: any,
  approvingAmbassador?: string
): Promise<activeQueue> => {
  let queuedTags: Tag[] = []
  let completedTags: Tag[] = []
  let timedOutTags: Tag[] = []

  const autoPostSetting =
    game.settings && !!game.settings['queue::autoPost']
      ? parseInt(game.settings['queue::autoPost'])
      : 0
  /// TODO: check for the right ambassador here
  const approvingAmbassadorIsApproved = approvingAmbassador?.length

  // console.log({ autoPostSetting, game })
  if ((autoPostSetting && game.queuehash?.length) || approvingAmbassadorIsApproved) {
    /************** GET WINNING QUEUE *****************/
    adminBikeTagOpts =
      adminBikeTagOpts ??
      getBikeTagClientOpts(
        {
          method: 'get',
        } as unknown as request.Request,
        true,
        true
      )
    adminBikeTagOpts.game = game.name.toLocaleLowerCase()
    adminBikeTagOpts.imgur.hash = game.mainhash
    adminBikeTagOpts.imgur.queuehash = game.queuehash
    adminBikeTagOpts.imgur.archivehash = game.archivehash

    const biketag = new BikeTagClient(adminBikeTagOpts)
    const getQueueResponse = await biketag.getQueue(undefined, {
      source: 'imgur',
    })
    queuedTags = getQueueResponse.success ? getQueueResponse.data : []
    if (queuedTags?.length) {
      completedTags = queuedTags.filter((t) => t.foundImageUrl?.length && t.mysteryImageUrl?.length)

      if (completedTags.length) {
        const now = Date.now()
        const tagAutoPostTimer = 1000 * 60 * autoPostSetting
        timedOutTags = completedTags.filter((t) => now - t.mysteryTime * 1000 > tagAutoPostTimer)

        if (timedOutTags.length) {
          const orderedTimedOutTags = timedOutTags.sort((t1, t2) => t1.mysteryTime - t2.mysteryTime)
          timedOutTags = orderedTimedOutTags
        }
      }
    }
  }

  return {
    queuedTags,
    completedTags,
    timedOutTags,
  }
}

export const setNewBikeTagPost = async (
  winningBikeTagPost: Tag,
  game: Game,
  currentBikeTag?: Tag
): Promise<BackgroundProcessResults> => {
  const biketagOpts = getBikeTagClientOpts(
    { method: 'get' } as unknown as request.Request,
    true,
    true
  )
  biketagOpts.game = game?.slug
  biketagOpts.imgur.hash = game?.mainhash
  const biketag = new BikeTagClient(biketagOpts)
  currentBikeTag = currentBikeTag ?? ((await biketag.getTag()).data as Tag) // the "current" mystery tag to be updated
  let errors = false
  const results = []

  try {
    if (winningBikeTagPost.discussionUrl) {
      const discussionUrlObject = JSON.parse(winningBikeTagPost.discussionUrl)
      if (discussionUrlObject && typeof discussionUrlObject.postToReddit !== 'undefined') {
        /// TODO: post to Reddit and save the URL here
        winningBikeTagPost.discussionUrl = ''
      }
    }
    if (winningBikeTagPost.mentionUrl) {
      const mentionUrlObject = JSON.parse(winningBikeTagPost.mentionUrl)
      if (mentionUrlObject && typeof mentionUrlObject.postToTwitter === 'undefined') {
        /// TODO: post to Reddit and save the URL here
        winningBikeTagPost.mentionUrl = ''
      }
    }
  } catch (e) {
    winningBikeTagPost.discussionUrl =
      winningBikeTagPost.discussionUrl?.indexOf('postToReddit') > 0
        ? ''
        : winningBikeTagPost.discussionUrl
    winningBikeTagPost.mentionUrl =
      winningBikeTagPost.mentionUrl?.indexOf('postToTwitter') > 0
        ? ''
        : winningBikeTagPost.mentionUrl
  }
  const newBikeTagPost = BikeTagClient.getters.getOnlyMysteryTagFromTagData(winningBikeTagPost) // the new "current" mystery tag
  try {
    /************** UPDATE CURRENT BIKETAG WITH FOUND IMAGE *****************/
    currentBikeTag.foundImageUrl = winningBikeTagPost.foundImageUrl
    currentBikeTag.foundTime = winningBikeTagPost.foundTime
    currentBikeTag.foundLocation = winningBikeTagPost.foundLocation
    currentBikeTag.foundPlayer = winningBikeTagPost.foundPlayer
    console.log('updating current BikeTag with the winning tag found information', currentBikeTag)
    const currentBikeTagUpdateResult = await biketag.updateTag(currentBikeTag)
    // console.log({ currentBikeTagUpdateResult })
    if (currentBikeTagUpdateResult.success) {
      results.push({
        message: 'current BikeTag updated',
        game: game.name,
        tag: currentBikeTag,
      })
    } else {
      results.push({
        message: 'current BikeTag was not updated',
        error: currentBikeTagUpdateResult.error,
        game: game.name,
        tag: currentBikeTag,
      })
      errors = true
    }

    /************** SET NEW BIKETAG POST FROM QUEUE *****************/
    const newBikeTagUpdateResult = await biketag.updateTag(newBikeTagPost)
    if (newBikeTagUpdateResult.success) {
      results.push({
        message: 'new BikeTag posted',
        game: game.name,
        tag: newBikeTagUpdateResult.data,
      })
    } else {
      results.push({
        message: 'new BikeTag was not posted',
        error: newBikeTagUpdateResult.error,
        game: game.name,
        tag: newBikeTagPost,
      })
      errors = true
    }

    if (currentBikeTagUpdateResult.success && newBikeTagUpdateResult.success) {
      const newPostedBikeTag = newBikeTagUpdateResult.data as unknown as Tag
      const postToReddit = false
      if (postToReddit) {
        const postedToRedditResult = await biketag.updateTag(newPostedBikeTag, { source: 'reddit' })
        if (postedToRedditResult.success) {
          results.push({
            message: 'new BikeTag posted to Reddit',
            game: game.name,
            tag: postedToRedditResult.data,
          })
        } else {
          results.push({
            message: 'new BikeTag was not posted to Reddit',
            error: postedToRedditResult.error,
            game: game.name,
            tag: newPostedBikeTag,
          })
          errors = true
        }
      } else {
        /// TODO: REMOVE LEGACY HACK
        axios
          .get(
            `https://${game.name.toLowerCase()}.biketag.org?flushCache=true&resendNotification=true`
          )
          .catch((e) => {
            /// Unimportant
          })
        ////
      }

      const ambassadors = (await biketag.ambassadors(undefined, {
        source: 'sanity',
      })) as Ambassador[]
      const thisGamesAmbassadors = ambassadors.filter(
        (a) => game.ambassadors.indexOf(a.name) !== -1
      )
      const winningTagnumber = newPostedBikeTag.tagnumber
      const host = `https://${game.name}.biketag.org`
      const logo = game.logo?.length
        ? game.logo.indexOf('imgur.co') !== -1
          ? game.logo
          : getSanityImageUrl(game.logo)
        : `${host}${defaultLogo}`
      await sendEmailsToAmbassadors(
        'biketag-auto-posted',
        `New BikeTag Round (#${winningTagnumber}) Auto-Posted for [${game.name}]`,
        thisGamesAmbassadors,
        (a) => {
          console.log({ a })
          return {
            currentBikeTag: currentBikeTagUpdateResult.data,
            newBikeTagPost: newBikeTagUpdateResult.data,
            logo,
            ambassadorsUrl: `${host}/#/queue?btaId=${a?.id}`,
            tagAutoApprovedText:
              'This tag was auto-approved by the AutoPost feature for being the first, completed, BikeTag Post to be submitted. If there is a problem with this tag, please click the button below to address the issue.',
            newBikeTagRoundTitle: ``,
            newBikeTagRoundText: `BikeTag Round #${winningTagnumber} was just auto-posted!`,
            tosText: 'Terms & Conditions',
            replyToRemoveLink:
              'reply to this email to request that these emails no longer be sent to you',
            newBikeTagRoundFooter: 'Thank you for being a BikeTag Ambassador!',
            btaDashboardButton: 'BikeTag Ambassador dashboard',
            host,
            game: game.name,
            redditLink: `https://reddit.com/r/${
              game.subreddit?.length ? game.subreddit : 'biketag'
            }`,
            twitterLink: `https://twitter.com/${game.twitter?.length ? game.twitter : 'biketag'}`,
            // instagramLink: `https://www.reddit.com/r/${game. ?? 'biketag'}`,
          }
        }
      )

      /************** REMOVE NEWLY POSTED BIKETAG FROM QUEUE *****************/
      const nonAdminBikeTagOpts = getBikeTagClientOpts(
        {
          method: 'get',
        } as unknown as request.Request,
        true
      )
      nonAdminBikeTagOpts.game = game.name.toLocaleLowerCase()
      nonAdminBikeTagOpts.imgur.hash = game.queuehash
      const nonAdminBikeTag = new BikeTagClient(nonAdminBikeTagOpts)
      console.log({ config: nonAdminBikeTag.config() })

      const deleteWinningTagFromQueueResult = await nonAdminBikeTag.deleteTag(winningBikeTagPost)
      if (deleteWinningTagFromQueueResult.success) {
        results.push({
          message: 'winning tag deleted from queue',
          game: game.name,
          tag: winningBikeTagPost,
        })
      } else {
        console.log({ deleteQueuedTagResult: deleteWinningTagFromQueueResult })
        results.push({
          message: 'error deleting winning tag from queue',
          game: game.name,
          tag: winningBikeTagPost,
        })
        errors = true
      }
    }
  } catch (e) {
    results.push({
      message: 'error setting new BikeTag Post',
      error: e?.message ?? e,
      game: game.name,
      current: currentBikeTag,
      tag: newBikeTagPost,
    })
    errors = true
  }

  return {
    results,
    errors,
  }
}

export const getWinningTagForCurrentRound = (timedOutTags: Tag[], currentBikeTag: Tag): Tag => {
  if (timedOutTags.length) {
    const orderedTimedOutTags = timedOutTags.sort((t1, t2) => t1.mysteryTime - t2.mysteryTime)
    const winnerWinnerChickenDinner = orderedTimedOutTags[0] // the "first" completed tag in the queue

    if (currentBikeTag.tagnumber === winnerWinnerChickenDinner.tagnumber - 1) {
      return winnerWinnerChickenDinner
    }
  }

  return undefined
}

const getAuthManagementToken = async () => {
  try {
    return await axios({
      method: "POST",
      url: `https://${process.env.A_DOMAIN}/oauth/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify({
        'grant_type': 'client_credentials',
        'client_id': process.env.A_M_CID,
        'client_secret': process.env.A_M_CS,
        'audience': process.env.A_AUDIENCE
      })
    })
  } catch (e) {
    console.log(e)
  }
}

export const auth0Headers = async () => ({
    'Authorization': `Bearer ${(await getAuthManagementToken()).data?.access_token}`
})

export const acceptCorsHeaders = () => ({
    Accept: '*',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Max-Age': '8640',
})

export const constructAmbassadorProfile = (
  profile: any = {},
  defaults: any = {}
): BikeTagProfile => {
  const user_metadata = {
    name: profile?.user_metadata?.name ?? defaults?.user_metadata?.name ?? '',
    passcode: profile?.user_metadata?.passcode ?? defaults?.user_metadata?.passcode ?? '',
    social: {
      reddit:
        profile?.user_metadata?.social?.reddit ?? defaults?.user_metadata?.social?.reddit ?? '',
      instagram:
        profile?.user_metadata?.social?.instagram ??
        defaults?.user_metadata?.social?.instagram ??
        '',
      twitter:
        profile?.user_metadata?.social?.twitter ?? defaults?.user_metadata?.social?.twitter ?? '',
      imgur: profile?.user_metadata?.social?.imgur ?? defaults?.user_metadata?.social?.imgur ?? '',
      discord:
        profile?.user_metadata?.social?.discord ?? defaults?.user_metadata?.social?.discord ?? '',
    },
    credentials: {
      imgur: {
        clientId:
          profile?.user_metadata?.credentials?.imgur.clientId ??
          defaults?.user_metadata?.credentials?.imgur.clientId ??
          '',
        clientSecret:
          profile?.user_metadata?.credentials?.imgur.clientSecret ??
          defaults?.user_metadata?.credentials?.imgur.clientSecret ??
          '',
        refreshToken:
          profile?.user_metadata?.credentials?.imgur.refreshToken ??
          defaults?.user_metadata?.credentials?.imgur.refreshToken ??
          '',
      },
      sanity: {
        projectId:
          profile?.user_metadata?.credentials?.sanity.projectId ??
          defaults?.user_metadata?.credentials?.sanity.projectId ??
          '',
        dataset:
          profile?.user_metadata?.credentials?.sanity.dataset ??
          defaults?.user_metadata?.credentials?.sanity.dataset ??
          '',
      },
      reddit: {
        clientId:
          profile?.user_metadata?.credentials?.reddit.clientId ??
          defaults?.user_metadata?.credentials?.reddit.clientId ??
          '',
        clientSecret:
          profile?.user_metadata?.credentials?.reddit.clientSecret ??
          defaults?.user_metadata?.credentials?.reddit.clientSecret ??
          '',
        username:
          profile?.user_metadata?.credentials?.reddit.username ??
          defaults?.user_metadata?.credentials?.reddit.username ??
          '',
        password:
          profile?.user_metadata?.credentials?.reddit.password ??
          defaults?.user_metadata?.credentials?.reddit.password ??
          '',
      },
    },
    options: {
      skipSteps:
        profile?.user_metadata?.options?.skipSteps ??
        defaults?.user_metadata?.options?.skipSteps ??
        false,
    },
  }
  return {
    name: profile.name ?? defaults.name ?? '',
    sub: profile.sub ?? defaults.sub ?? '',
    slug: profile.slug ?? defaults.slug ?? '',
    address1: profile.address1 ?? defaults.address1 ?? '',
    address2: profile.address2 ?? defaults.address2 ?? '',
    city: profile.city ?? defaults.city ?? '',
    country: profile.country ?? defaults.country ?? '',
    email: profile.email ?? defaults.email ?? '',
    isBikeTagAmbassador: profile.isBikeTagAmbassador ?? defaults.isBikeTagAmbassador ?? '',
    locale: profile.locale ?? defaults.locale ?? '',
    nonce: profile.nonce ?? defaults.nonce ?? '',
    phone: profile.phone ?? defaults.phone ?? '',
    picture: profile.picture ?? defaults.picture ?? '',
    user_metadata,
    zipcode: profile.zipcode ?? defaults.zipcode ?? '',
  }
}

export const constructPlayerProfile = (profile: any = {}, defaults: any = {}): BikeTagProfile => {
  const user_metadata = {
    name: profile?.user_metadata?.name ?? defaults?.user_metadata?.name ?? '',
    social: {
      reddit: profile?.user_metadata?.reddit ?? defaults?.user_metadata?.reddit ?? '',
      instagram: profile?.user_metadata?.instagram ?? defaults?.user_metadata?.instagram ?? '',
      twitter: profile?.user_metadata?.twitter ?? defaults?.user_metadata?.twitter ?? '',
      imgur: profile?.user_metadata?.imgur ?? defaults?.user_metadata?.imgur ?? '',
      discord: profile?.user_metadata?.discord ?? defaults?.user_metadata?.discord ?? '',
    },
    options: {
      skipSteps:
        profile?.user_metadata?.options?.skipSteps ??
        defaults?.user_metadata?.options?.skipSteps ??
        false,
    },
  }
  return {
    name: profile.name ?? defaults.name ?? '',
    sub: profile.sub ?? defaults.sub ?? '',
    slug: profile.slug ?? defaults.slug ?? '',
    email: profile.email ?? defaults.email ?? '',
    locale: profile.locale ?? defaults.locale ?? '',
    nonce: profile.nonce ?? defaults.nonce ?? '',
    picture: profile.picture ?? defaults.picture ?? '',
    user_metadata,
    zipcode: profile.zipcode ?? defaults.zipcode ?? '',
  } as BikeTagProfile
}

export const getEnvironmentVariable = (key: string) => {
  if (process.env[key]) {
    return decompress(process.env[key], { inputEncoding: 'Base64' })
  }
}
