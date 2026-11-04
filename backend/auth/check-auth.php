
<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../config/session.php";

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);

    echo json_encode([
        "status" => "error",
        "authenticated" => false,
        "message" => "Not logged in."
    ]);

    exit;
}

echo json_encode([
    "status" => "success",
    "authenticated" => true,
    "user" => [
        "user_id" => $_SESSION["user_id"],
        "username" => $_SESSION["username"],
        "full_name" => $_SESSION["full_name"],
        "role" => $_SESSION["role"]
    ]
]);
