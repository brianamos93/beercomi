CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('basic', 'admin')) NOT NULL
);

CREATE TABLE breweries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    date_of_founding TEXT NOT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    author UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER breweries_update_timestamp
BEFORE UPDATE ON breweries
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE beers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    brewery_id UUID REFERENCES breweries(id) ON DELETE CASCADE,
    description TEXT,
    ibu INT,
    abv NUMERIC,
    color TEXT,
    author UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Linking table for many-to-many relationships if needed
CREATE TABLE user_favorite_beers (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, beer_id)
);

INSERT INTO users(email, password, role) VALUES ('test@test.com', 'password', 'admin')

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'basic';

ALTER TABLE breweries ADD COLUMN verification BOOLEAN DEFAULT FALSE;
