const express = require('express')


const app = express();
require('express-async-errors')
const cors = require('cors');

import beerRoutes from "./routes/beerRoutes"
import userRoutes from "./routes/userRoutes";
const middleware = require('./utils/middleware');

app.use(cors({
	origin: "http://localhost:3000",
	credentials: true,
}));
app.use(express.static('dist'))
app.use(express.json());

app.use(middleware.requestLogger);

app.use("/beers/", beerRoutes);
app.use("/", userRoutes);

app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);





module.exports = app