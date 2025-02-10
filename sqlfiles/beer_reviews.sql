CREATE TABLE beer_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author UUID REFERENCES users(id) ON DELETE CASCADE DEFAULT NULL,
    beer UUID REFERENCES beers(id) ON DELETE CASCADE DEFAULT NULL,
    review TEXT NOT NULL,
    rating NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 10)
);