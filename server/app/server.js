'use strict'
import Service from '../../core/services/Service'
import {instance as Enum} from '../../core/enums'
import {ErrorExtended as Error} from './response/Error'
import {Response} from './response/Response'

var express = require('express'),
	exphbs = require('express-handlebars'),
	Log = Service.Log(),
	https = require('https'),
	fs = require('fs'),
	config = require('./config.json')

export default class Server {
	constructor(port) {
		this.port = port

		let app = express()
		app.set('json spaces', 4)
		app.engine('handlebars', exphbs({defaultLayout: 'main'}))
		app.set('view engine', 'handlebars')
		app.use((request, response, next) => {
			let host = request.headers.host.replace(/(.*):([0-9]+)/g, "$1")
			if (['localhost', '127.0.0.1', 'shortr.li'].indexOf(host) === -1) {
				Response.Error(response, new Error(Enum.error.message.CORS, Enum.error.code.FORBIDDEN))
				return
			}

			response.header('Access-Control-Allow-Origin', host)
			response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
			response.header('Access-Control-Allow-Headers', 'Content-Type')
			next()
		})
		app.use('/static', express.static('static'))
		this.app = app
	}

	Start() {
		let server = https.createServer({
			key: fs.readFileSync(config.localCertificate.key, 'utf8'),
			cert: fs.readFileSync(config.localCertificate.cert, 'utf8')
		}, this.app)

		server.listen(this.port, () => {
			Log.Say(`Server listening on port ${this.port}`)
		})

		this.server = server
	}

	App() {
		return this.app
	}

	Route(route, fn) {
		this.app.get(route, fn)
	}
}