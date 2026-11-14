// Package migrations holds the SQL files that build the database, in order.
// They are compiled into the server binary, so it needs no files next to it.
package migrations

import "embed"

//go:embed *.sql
var Files embed.FS
