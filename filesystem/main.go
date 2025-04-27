package main

import (
	"context"
	"fmt"
	"hideenv/filesystem/handlers"
	"hideenv/filesystem/services"
	"log"
	"os"
	"os/signal"
	"syscall"

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

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	wm.Watcher.Close()
	log.Println("Service stopped")
}
