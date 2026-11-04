
<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../config/session.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "status" => "error",
        "message" => "Only POST requests are allowed."
    ]);

    exit;
}

$_SESSION = [];

if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        "",
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

session_destroy();

echo json_encode([
    "status" => "success",
    "message" => "Logged out successfully."
]);
