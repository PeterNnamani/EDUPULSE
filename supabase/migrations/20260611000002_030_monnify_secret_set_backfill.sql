/*
  # 030 - Backfill monnify_secret_set for schools that saved keys before 029
*/

UPDATE school_payment_config
SET monnify_secret_set = true
WHERE provider = 'monnify'
  AND monnify_secret_set IS NOT TRUE
  AND monnify_secret_key IS NOT NULL
  AND btrim(monnify_secret_key) <> '';
