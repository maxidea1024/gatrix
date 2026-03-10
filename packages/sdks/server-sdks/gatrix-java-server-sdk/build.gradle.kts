plugins {
    kotlin("jvm") version "1.9.22"
    application
}

group = "com.gatrix"
version = "1.0.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    // HTTP Client
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // JSON
    implementation("com.google.code.gson:gson:2.11.0")

    // Logging
    implementation("org.slf4j:slf4j-api:2.0.12")

    // Redis (Jedis for Pub/Sub)
    implementation("redis.clients:jedis:5.1.0")

    // Hashing (MurmurHash3)
    implementation("com.google.guava:guava:33.0.0-jre")

    // Test
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testImplementation("io.mockk:mockk:1.13.9")
    testRuntimeOnly("org.slf4j:slf4j-simple:2.0.12")
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = true
    }
}

application {
    mainClass.set("com.gatrix.server.sdk.example.ExampleKt")
}
