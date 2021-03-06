'use strict'
import {instance as Log} from './services/Log'
import {instance as Recaptcha} from './services/Recaptcha'
import {instance as Enum} from '../../core/enums'
import {Response} from './response/Response'
import Database from './database/db'
import {instance as Params} from './params'
import {Messages} from './messages'
import {ErrorExtended as Error} from './response/Error'
import Server from './server'
import {instance as Crypto} from './crypto'
import Util from './util'

let server = new Server(),
	path = require('path'),
	credentials = require('./credentials.json'),
	html = require('./index.html')

class App {
	constructor() {
		this.credentials = process.env.NODE_ENV === 'production' ? credentials.production : credentials.development
		this.db = new Database(this.credentials.database)

		Params.Apply(server)

		server.Route('/api/hash/get/:hash', (request, response) => {
			this.db.Links.Get(request.params.hash)
				.then(result => {
					if (result !== null) {
						let link = result.get('link')

						if (!!link) {
							Response.Ok(response, Messages.Link(request.params.hash, link))
							return
						}
					}

					Response.Ok(response, Messages.Link(request.params.hash, null))
				})
				.catch(error => {
					console.log(error)
					Response.Error(response, new Error(Enum.error.message.GENERIC_ERROR, Enum.error.code.ERROR))
				})
		})

		server.Route('/api/hash/create/:url/:recaptchaToken', (request, response) => {
			let url = request.params.url.toLowerCase(),
				regex = url.match(/^(http|https|ftp):\/\//g)
			if (!(!!regex && regex.length)) {
				url = 'http://' + url
			}

			Recaptcha.Verify(request.params.recaptchaToken)
				.then(data => {
					if ('success' in data && data.success) {
						let hash = Crypto.TimestampHash(url),
							ip = Util.GetRequestIP(request) || null

						this.db.Links.Create(url, hash, ip)
							.then(result => {
								Response.Ok(response, Messages.Link(hash, url))
							})
							.catch(error => {
								console.log(error)
								Response.Error(response, new Error(Enum.error.message.GENERIC_ERROR, Enum.error.code.ERROR))
							})
					} else {
						Response.Error(response, new Error(Enum.error.message.RECAPTCHA_FAILED, Enum.error.code.FORBIDDEN))
					}
				})
				.catch(error => {
					console.error(error)
					Response.Error(response, new Error(Enum.error.message.GENERIC_ERROR, Enum.error.code.ERROR))
				})
		})

		server.Route('/api*', (request, response) => {
			Response.Error(response, new Error(Enum.error.message.NOT_FOUND, Enum.error.code.NOT_FOUND))
		})

		server.Route(['/privacy', '/terms'], (request, response) => {
			response.send(html)
		})

		server.Route('/:hash', (request, response) => {
			this.db.Links.Get(request.params.hash)
				.then(result => {
					if (result !== null) {
						let link = result.get('link')

						if (!!link) {
							this.db.Users.Add(request.params.hash, request.headers['user-agent'])
								.catch(error => {
									console.log(error)
								})

							response.redirect(link)
							return
						}
					}

					response.redirect('/?error=NOT_FOUND')
				})
				.catch(error => {
					console.log(error)
					response.redirect('/?error=GENERIC_ERROR')
				})
		})

		server.Route('/', (request, response) => {
			response.send(html)
		})

		server.Route('*', (request, response) => {
			response.redirect('/?error=NOT_FOUND')
		})

		server.Start()
	}
}

let app = new App()