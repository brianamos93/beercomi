CREATE TABLE beers_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    beer_id UUID NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_beers
        FOREIGN KEY (beer_id)
        REFERENCES beers(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_user_beer UNIQUE (user_id, beer_id)
);

CREATE TABLE breweries_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    brewery_id UUID NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_breweries
        FOREIGN KEY (brewery_id)
        REFERENCES breweries(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_user_brewery UNIQUE (user_id, brewery_id)
);

