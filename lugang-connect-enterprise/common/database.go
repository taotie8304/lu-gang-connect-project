package common

import (
	"github.com/lugang-connect/enterprise/common/env"
)

var UsingSQLite = false
var UsingPostgreSQL = false
var UsingMySQL = false

var SQLitePath = "one-api.db"
var SQLiteBusyTimeout = env.Int("SQLITE_BUSY_TIMEOUT", 3000)
