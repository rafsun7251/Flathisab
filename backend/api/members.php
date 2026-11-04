
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    http_response_code(401);
    echo json_encode([
        "status" => "error",
        "message" => "Authentication required."
    ]);
    exit;
}

try {
    $database = new Database();
    $db = $database->connect();

    $stmt = $db->prepare("
        SELECT user_id, full_name, username
        FROM users
        WHERE role = 'MEMBER'
          AND account_status = 'ACTIVE'
        ORDER BY user_id
    ");

    $stmt->execute();

    echo json_encode([
        "status" => "success",
        "data" => $stmt->fetchAll()
    ]);

} catch (Throwable $e) {
    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Unable to load members."
    ]);
}
