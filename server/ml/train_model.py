"""
Trains and evaluates the draft career-value model, computes each prospect's
"surprise score", and saves the model for later use by the API.

Architecture choice — and why it isn't just a convenience pick:
stage 2's exploration (server/docs/exploration_findings.md) found that ~48%
of linked combine prospects are missing key drill numbers, and *not* at
random — locked-in elite prospects (Joe Burrow, Chase Young, ...) often skip
drills deliberately, which makes "didn't run it" a signal worth keeping, not
noise to impute away. HistGradientBoostingRegressor handles missing numeric
values *and* categorical features natively, learning from the missingness
pattern itself rather than requiring it to be filled in first — so the
finding shaped the model choice directly, instead of being patched around
with imputation that would have laundered the signal out.

Evaluation uses a temporal split (train on older classes, test on newer-but-
still-seasoned ones) rather than a random one — it mirrors the real use case
(predicting a brand-new class's value from older ones) and avoids the
optimism a random split can introduce when rows from the same era share
context a model could quietly key on.
"""
import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from ml.prepare_data import FEATURE_COLUMNS, TARGET_COLUMN, load_dataset

MODEL_PATH = "ml/draft_value_model.joblib"
TEST_YEARS_CUTOFF = 2017  # train: draft_year <= cutoff; test: draft_year > cutoff (still seasoned)


def _split(df):
    return df[df["draft_year"] <= TEST_YEARS_CUTOFF], df[df["draft_year"] > TEST_YEARS_CUTOFF]


def train_and_evaluate():
    df = load_dataset()
    train, test = _split(df)
    print(f"dataset: {len(df)} seasoned prospects ({df['draft_year'].min()}-{df['draft_year'].max()})")
    print(f"train: {len(train)} rows (draft_year <= {TEST_YEARS_CUTOFF}), "
          f"test: {len(test)} rows (draft_year > {TEST_YEARS_CUTOFF})")

    X_train, y_train = train[FEATURE_COLUMNS], train[TARGET_COLUMN]
    X_test, y_test = test[FEATURE_COLUMNS], test[TARGET_COLUMN]

    model = HistGradientBoostingRegressor(categorical_features=["pos"], random_state=42)
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, pred)
    r2 = r2_score(y_test, pred)
    naive_pred = np.full_like(y_test, y_train.mean(), dtype=float)
    naive_mae = mean_absolute_error(y_test, naive_pred)

    print(f"\nMAE: {mae:.1f} career_av points  "
          f"(a model that always guesses the training-set average gets {naive_mae:.1f})")
    print(f"R^2: {r2:.2f}  (fraction of career-value variance the combine+draft-slot profile explains)")
    print("\nHonest read: career_av ranges roughly 0-200 across a career, and even elite scouting departments\n"
          "struggle with this exact prediction. Beating the naive baseline by a clear margin means the model\n"
          "found *real* signal in measurables + draft slot — not that it can reliably call individual careers.")

    return model, df, test, pred


def surprise_scores(model, df):
    """
    actual career_av minus predicted: positive = outperformed what their
    combine-and-slot profile predicted (a "steal" the model didn't see
    coming), negative = underperformed it (a model-flagged "bust").
    Distinct from app/data/draft.py's steals/busts, which only look at
    draft slot — this looks at the fuller measurable profile.
    """
    out = df.copy()
    out["predicted_av"] = model.predict(df[FEATURE_COLUMNS])
    out["surprise"] = out[TARGET_COLUMN] - out["predicted_av"]
    return out.sort_values("surprise", ascending=False)


def main():
    model, df, test, pred = train_and_evaluate()

    scored = surprise_scores(model, df)
    cols = ["player_name", "draft_year", "round", "pick", "pos", "career_av", "predicted_av", "surprise"]

    print("\n=== Biggest positive surprises (outperformed their measurable profile) ===")
    print(scored[cols].head(8).round(1).to_string(index=False))

    print("\n=== Biggest negative surprises (underperformed their measurable profile) ===")
    print(scored[cols].tail(8).iloc[::-1].round(1).to_string(index=False))

    joblib.dump({"model": model, "feature_columns": FEATURE_COLUMNS}, MODEL_PATH)
    print(f"\nSaved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
