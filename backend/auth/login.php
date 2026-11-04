
<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Only POST requests are allowed."
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

$username = trim($data["username"] ?? "");
$password = $data["password"] ?? "";

if ($username === "" || $password === "") {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Username and password are required."
    ]);
    exit;
}

try {
    $database = new Database();
    $db = $database->connect();

    $stmt = $db->prepare("
        SELECT user_id, full_name, username, password_hash,
               role, account_status
        FROM users
        WHERE username = :username
        LIMIT 1
    ");

    $stmt->execute([":username" => $username]);
    $user = $stmt->fetch();

    if (
        !$user ||
        $user["account_status"] !== "ACTIVE" ||
        !password_verify($password, $user["password_hash"])
    ) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid username or password."
        ]);
        exit;
    }

    session_regenerate_id(true);

    $_SESSION["user_id"] = $user["user_id"];
    $_SESSION["username"] = $user["username"];
    $_SESSION["full_name"] = $user["full_name"];
    $_SESSION["role"] = $user["role"];

    echo json_encode([
        "status" => "success",
        "message" => "Login successful.",
        "user" => [
            "user_id" => $user["user_id"],
            "full_name" => $user["full_name"],
            "username" => $user["username"],
            "role" => $user["role"]
        ]
    ]);

} catch (Throwable $e) {

    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Server error. Please try again."
    ]);
}
