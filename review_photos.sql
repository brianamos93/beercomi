CREATE TABLE review_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    review_id UUID NOT NULL,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT now(),
    date_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review
        FOREIGN KEY (review_id)
        REFERENCES beer_reviews(id)
        ON DELETE CASCADE
);

CREATE TRIGGER set_date_updated
BEFORE UPDATE ON review_photos
FOR EACH ROW
EXECUTE FUNCTION update_date_updated();