const express = require('express')


const app = express();
require('express-async-errors')
const cors = require('cors');

import beerRoutes from "./routes/beerRoutes"
import userRoutes from "./routes/userRoutes";
import breweryRoutes from "./routes/breweryRoutes"
import searchRoutes from "./routes/searchRoute"
import storesRoutes from "./routes/storeRoutes"
import recentRoutes from "./routes/recentactivtyRoutes"
import path from "path";
const middleware = require('./utils/middleware');

app.use(cors({
	origin: "http://localhost:3000",
	credentials: true,
}));
app.use(express.static('dist'))
app.use(express.json());

app.use(middleware.requestLogger);

app.use("/beers", beerRoutes);
app.use("/breweries", breweryRoutes)
app.use("/search", searchRoutes)
app.use("/stores", storesRoutes)
app.use("/recent", recentRoutes)
app.use("/", userRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

module.exports = app