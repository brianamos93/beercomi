const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')


app.listen(3005, () =>
	console.log('REST API server ready at: http://localhost:3005'),
  )