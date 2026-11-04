
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

function categoryResponse($status, $message, $code = 200, $data = null)
{
    http_response_code($code);

    $response = [
        "status" => $status,
        "message" => $message
    ];

    if ($data !== null) {
        $response["data"] = $data;
    }

    echo json_encode($response);
    exit;
}

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    categoryResponse("error", "Authentication required.", 401);
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    categoryResponse("error", "Method not allowed.", 405);
}

try {
    $database = new Database();
    $db = $database->connect();

    $stmt = $db->query("
        SELECT
            category_id,
            category_name,
            allocation_method
        FROM expense_categories
        WHERE is_active = 1
        ORDER BY category_name ASC
    ");

    categoryResponse(
        "success",
        "Expense categories retrieved successfully.",
        200,
        $stmt->fetchAll()
    );

} catch (Throwable $e) {
    error_log($e->getMessage());

    categoryResponse(
        "error",
        "Could not load expense categories.",
        500
    );
}
