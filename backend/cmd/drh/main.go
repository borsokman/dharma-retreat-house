// Command drh runs the Dharma Retreat House booking server and manages staff accounts.
//
//	drh serve                      start the API (see -h for options)
//	drh staff add EMAIL NAME       create an account (-role admin|staff), asks for the password
//	drh staff password EMAIL       set a new password (signs that account out everywhere)
//	drh staff disable EMAIL        block an account (signs it out at once); enable undoes it
//	drh staff list
//	drh demo                       put made-up bookings into an EMPTY database, for testing
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"

	"dharma/backend/internal/api"
	"dharma/backend/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	var err error
	switch os.Args[1] {
	case "serve":
		err = serve(os.Args[2:])
	case "staff":
		err = staff(os.Args[2:])
	case "demo":
		err = demo(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage:
  drh serve [-addr :8080] [-db drh.db] [-dev]
  drh staff add EMAIL "FULL NAME" [-role admin|staff]
  drh staff password EMAIL
  drh staff disable|enable EMAIL
  drh staff list
  drh demo

Every command takes -db (default: $DRH_DB, else drh.db).`)
	os.Exit(2)
}

func defaultDB() string {
	if v := os.Getenv("DRH_DB"); v != "" {
		return v
	}
	return "drh.db"
}

func serve(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", envOr("DRH_ADDR", "127.0.0.1:8080"), "address to listen on")
	dbPath := fs.String("db", defaultDB(), "SQLite database file")
	dev := fs.Bool("dev", false, "local development: allow http cookies and the Vite dev server origin")
	origins := fs.String("allow-origin", os.Getenv("DRH_ALLOW_ORIGIN"), "extra origins allowed to send changes, comma separated")
	fs.Parse(args)

	st, err := store.Open(*dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	srv := &api.Server{Store: st, SecureCookies: !*dev, Log: slog.Default()}
	if *origins != "" {
		srv.AllowedOrigins = strings.Split(*origins, ",")
	}
	if *dev {
		srv.AllowedOrigins = append(srv.AllowedOrigins, "http://localhost:5173", "http://127.0.0.1:5173")
	}
	hs := &http.Server{
		Addr: *addr, Handler: srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		hs.Shutdown(shutdown)
	}()
	mode := ""
	if *dev {
		mode = " (dev mode: cookies over plain http)"
	}
	slog.Info("booking API listening"+mode, "addr", *addr, "db", *dbPath)
	if err := hs.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// openFor parses the common -db flag (anywhere among args) and opens the database.
func openFor(name string, args []string, extra func(*flag.FlagSet)) (*store.Store, []string, error) {
	fs := flag.NewFlagSet(name, flag.ExitOnError)
	dbPath := fs.String("db", defaultDB(), "SQLite database file")
	if extra != nil {
		extra(fs)
	}
	// allow flags after the positional arguments too: "staff add a@b.c Name -role admin"
	var positional []string
	for len(args) > 0 {
		fs.Parse(args)
		args = fs.Args()
		if len(args) > 0 {
			positional = append(positional, args[0])
			args = args[1:]
		}
	}
	st, err := store.Open(*dbPath)
	return st, positional, err
}

func staff(args []string) error {
	if len(args) == 0 {
		usage()
	}
	ctx := context.Background()
	var role string
	st, pos, err := openFor("staff "+args[0], args[1:], func(fs *flag.FlagSet) {
		fs.StringVar(&role, "role", "staff", "admin or staff")
	})
	if err != nil {
		return err
	}
	defer st.Close()

	need := func(n int) {
		if len(pos) != n {
			usage()
		}
	}
	switch args[0] {
	case "add":
		need(2)
		pw, err := askPassword()
		if err != nil {
			return err
		}
		u, err := st.CreateStaff(ctx, pos[0], pos[1], pw, role)
		if err != nil {
			return err
		}
		fmt.Printf("Created %s account for %s <%s>.\n", u.Role, u.Name, u.Email)
	case "password":
		need(1)
		pw, err := askPassword()
		if err != nil {
			return err
		}
		if err := st.SetStaffPassword(ctx, pos[0], pw); err != nil {
			return err
		}
		fmt.Println("Password changed. That account is signed out everywhere.")
	case "disable", "enable":
		need(1)
		if err := st.SetStaffActive(ctx, pos[0], args[0] == "enable"); err != nil {
			return err
		}
		fmt.Printf("Account %sd.\n", args[0])
	case "list":
		users, err := st.ListStaff(ctx)
		if err != nil {
			return err
		}
		if len(users) == 0 {
			fmt.Println("No staff accounts yet. Create one with: drh staff add EMAIL \"NAME\" -role admin")
		}
		for _, u := range users {
			state := ""
			if !u.Active {
				state = "  (disabled)"
			}
			fmt.Printf("%-6s %-32s %s%s\n", u.Role, u.Email, u.Name, state)
		}
	default:
		usage()
	}
	return nil
}

// askPassword reads a password twice without echoing it, or once from a pipe.
func askPassword() (string, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil && line == "" {
			return "", errors.New("no password given on standard input")
		}
		return strings.TrimRight(line, "\r\n"), nil
	}
	fmt.Fprint(os.Stderr, "Password (at least 10 characters): ")
	a, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	fmt.Fprint(os.Stderr, "Same password again: ")
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	if string(a) != string(b) {
		return "", errors.New("the two passwords differ")
	}
	return string(a), nil
}

func demo(args []string) error {
	ctx := context.Background()
	st, _, err := openFor("demo", args, nil)
	if err != nil {
		return err
	}
	defer st.Close()
	users, err := st.ListStaff(ctx)
	if err != nil {
		return err
	}
	if len(users) == 0 {
		return errors.New("create a staff account first: drh staff add EMAIL \"NAME\" -role admin")
	}
	n, err := st.SeedDemo(ctx, users[0].ID)
	if err != nil {
		return err
	}
	fmt.Printf("Added %d demo bookings around today.\n", n)
	return nil
}
