//go:build linux

package main

import (
	"context"
	"fmt"
	"hideenv/filesystem/handlers"
	"hideenv/filesystem/server"
	"hideenv/filesystem/services"
	"log"
	"net/http"
	"os"

	"github.com/redis/go-redis/v9"
)

var (
	ctx = context.Background()
)

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")

	redisClient := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
	})

	wm, err := services.NewWatchManager(redisClient)
	if err != nil {
		log.Fatal(err)
	}

	wm.Start(ctx)
	go handlers.HandleWatchChannels(ctx, wm, redisClient)
	log.Println("Service started")

	srv := server.NewServer()
	port := os.Getenv("SERVICE_PORT")
	if port == "" {
		port = "8945"
	}
	log.Println("Server is running on port", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), srv.Router))

	wm.Watcher.Close()
	log.Println("Service stopped")
}
