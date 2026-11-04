
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

// -----------------------------------------
// Common Response Helper
// -----------------------------------------

function mealResponse($status, $message, $httpCode = 200, $data = null)
{
    http_response_code($httpCode);

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

// -----------------------------------------
// Guest Quantity Validation
// -----------------------------------------

function isValidGuestQuantity($value)
{
    if (!is_numeric($value)) {
        return false;
    }

    $number = (float) $value;

    return $number >= 0
        && $number <= 50
        && abs($number * 2 - round($number * 2)) < 0.000001;
}

// -----------------------------------------
// Authentication
// -----------------------------------------

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    mealResponse("error", "Authentication required.", 401);
}

$currentUserId = (int) $_SESSION["user_id"];
$currentRole = $_SESSION["role"];

$isAdmin = ($currentRole === "ADMIN");

if (!$isAdmin && $currentRole !== "MEMBER") {
    mealResponse("error", "Access denied.", 403);
}

// -----------------------------------------
// Read JSON Request
// -----------------------------------------

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    $input = [];
}

try {

    $database = new Database();
    $db = $database->connect();

    $method = $_SERVER["REQUEST_METHOD"];

    // =========================================
    // GET: View Meal Records
    // =========================================

    if ($method === "GET") {

        $monthId = isset($_GET["month_id"])
            ? (int) $_GET["month_id"]
            : 0;

        $date = $_GET["date"] ?? null;

        if ($monthId > 0) {

            $stmt = $db->prepare("
                SELECT
                    me.meal_entry_id,
                    me.member_id,
                    me.entered_by,
                    me.meal_date,
                    me.meal_type,
                    me.quantity,
                    me.guest_quantity,
                    me.status,
                    me.note,
                    me.reviewed_by,
                    me.reviewed_at
                FROM meal_entries me
                INNER JOIN months m
                    ON me.meal_date BETWEEN m.start_date AND m.end_date
                WHERE m.month_id = :month_id
                ORDER BY
                    me.meal_date DESC,
                    me.meal_type,
                    me.member_id
            ");

            $stmt->execute([
                ":month_id" => $monthId
            ]);

        } elseif ($date !== null) {

            $parsedDate = DateTime::createFromFormat("!Y-m-d", $date);

            if (
                !$parsedDate ||
                $parsedDate->format("Y-m-d") !== $date
            ) {
                mealResponse("error", "Invalid date format.", 400);
            }

            $stmt = $db->prepare("
                SELECT
                    meal_entry_id,
                    member_id,
                    entered_by,
                    meal_date,
                    meal_type,
                    quantity,
                    guest_quantity,
                    status,
                    note,
                    reviewed_by,
                    reviewed_at
                FROM meal_entries
                WHERE meal_date = :meal_date
                ORDER BY meal_type, member_id
            ");

            $stmt->execute([
                ":meal_date" => $date
            ]);

        } else {

            mealResponse(
                "error",
                "Provide month_id or date to view meal records.",
                400
            );
        }

        $records = $stmt->fetchAll();

        mealResponse(
            "success",
            "Meal records retrieved successfully.",
            200,
            $records
        );
    }

    // =========================================
    // POST: Create Meal Entries
    // =========================================

    if ($method === "POST") {

        $entries = $input["entries"] ?? [];

        // Accept single entry also
        if (isset($input["member_id"])) {
            $entries = [$input];
        }

        // Maximum 8 entries: 4 members x 2 meals
        if (
            !is_array($entries) ||
            count($entries) < 1 ||
            count($entries) > 8
        ) {
            mealResponse(
                "error",
                "Submit between 1 and 8 meal entries at a time.",
                400
            );
        }

        $db->beginTransaction();

        $insertedIds = [];

        // Insert Query
        $insertStmt = $db->prepare("
            INSERT INTO meal_entries (
                member_id,
                entered_by,
                meal_date,
                meal_type,
                quantity,
                guest_quantity,
                status,
                note
            ) VALUES (
                :member_id,
                :entered_by,
                :meal_date,
                :meal_type,
                :quantity,
                :guest_quantity,
                'PENDING',
                :note
            )
        ");

        // Check Member
        $memberCheck = $db->prepare("
            SELECT user_id
            FROM users
            WHERE user_id = :member_id
              AND role = 'MEMBER'
              AND account_status = 'ACTIVE'
            LIMIT 1
        ");

        // Check Accounting Month
        $monthCheck = $db->prepare("
            SELECT month_id
            FROM months
            WHERE :meal_date BETWEEN start_date AND end_date
              AND status = 'OPEN'
            LIMIT 1
        ");

        foreach ($entries as $entry) {

            if (!is_array($entry)) {
                $db->rollBack();

                mealResponse(
                    "error",
                    "Invalid meal entry format.",
                    400
                );
            }

            $memberId = (int) ($entry["member_id"] ?? 0);

            $mealDate = $entry["meal_date"] ?? "";

            $mealType = strtoupper(
                (string) ($entry["meal_type"] ?? "")
            );

            $quantity = $entry["quantity"] ?? null;

            $guestQuantity = $entry["guest_quantity"] ?? 0;

            $note = trim(
                (string) ($entry["note"] ?? "")
            );

            // Validate Member and Meal Quantity
            if (
                $memberId <= 0 ||
                !in_array(
                    $mealType,
                    ["LUNCH", "DINNER"],
                    true
                ) ||
                !in_array(
                    $quantity,
                    [0, 0.5, 1, "0", "0.5", "1"],
                    true
                )
            ) {
                $db->rollBack();

                mealResponse(
                    "error",
                    "Invalid meal entry data.",
                    400
                );
            }

            // Validate Guest Quantity
            if (!isValidGuestQuantity($guestQuantity)) {

                $db->rollBack();

                mealResponse(
                    "error",
                    "Guest quantity must be between 0 and 50 in steps of 0.5.",
                    400
                );
            }

            // Validate Date
            $parsedDate = DateTime::createFromFormat(
                "!Y-m-d",
                $mealDate
            );

            if (
                !$parsedDate ||
                $parsedDate->format("Y-m-d") !== $mealDate
            ) {
                $db->rollBack();

                mealResponse(
                    "error",
                    "Invalid meal date.",
                    400
                );
            }

            // Verify Active Member
            $memberCheck->execute([
                ":member_id" => $memberId
            ]);

            if (!$memberCheck->fetch()) {

                $db->rollBack();

                mealResponse(
                    "error",
                    "Selected member does not exist or is inactive.",
                    400
                );
            }

            // Verify Open Accounting Month
            $monthCheck->execute([
                ":meal_date" => $mealDate
            ]);

            if (!$monthCheck->fetch()) {

                $db->rollBack();

                mealResponse(
                    "error",
                    "No open accounting month for this date.",
                    400
                );
            }

            // Save Meal Entry
            $insertStmt->execute([

                ":member_id" => $memberId,

                ":entered_by" => $currentUserId,

                ":meal_date" => $mealDate,

                ":meal_type" => $mealType,

                ":quantity" => $quantity,

                ":guest_quantity" => (float) $guestQuantity,

                ":note" => $note !== ""
                    ? $note
                    : null

            ]);

            $insertedIds[] = (int) $db->lastInsertId();
        }

        $db->commit();

        mealResponse(
            "success",
            "Meal entries submitted for Admin review.",
            201,
            [
                "meal_entry_ids" => $insertedIds
            ]
        );
    }

    // =========================================
    // PUT: Update or Review Meal Entries
    // =========================================

    if ($method === "PUT") {

        $entryId = (int) ($input["meal_entry_id"] ?? 0);

        if ($entryId <= 0) {

            mealResponse(
                "error",
                "Valid meal_entry_id is required.",
                400
            );
        }

        $db->beginTransaction();

        // Find Existing Entry
        $findStmt = $db->prepare("
            SELECT *
            FROM meal_entries
            WHERE meal_entry_id = :entry_id
            FOR UPDATE
        ");

        $findStmt->execute([
            ":entry_id" => $entryId
        ]);

        $existing = $findStmt->fetch();

        if (!$existing) {

            $db->rollBack();

            mealResponse(
                "error",
                "Meal entry not found.",
                404
            );
        }

        // Check Month Status
        $monthCheck = $db->prepare("
            SELECT status
            FROM months
            WHERE :meal_date BETWEEN start_date AND end_date
            LIMIT 1
        ");

        $monthCheck->execute([
            ":meal_date" => $existing["meal_date"]
        ]);

        $month = $monthCheck->fetch();

        if (!$month || $month["status"] !== "OPEN") {

            $db->rollBack();

            mealResponse(
                "error",
                "This month is closed.",
                403
            );
        }

        $action = $input["action"] ?? "update";

        // -------------------------------------
        // Admin Review
        // -------------------------------------

        if ($action === "review") {

            if (!$isAdmin) {

                $db->rollBack();

                mealResponse(
                    "error",
                    "Only Admin can review meal entries.",
                    403
                );
            }

            $newStatus = strtoupper(
                (string) ($input["status"] ?? "")
            );

            if (
                !in_array(
                    $newStatus,
                    ["VERIFIED", "FLAGGED", "REJECTED"],
                    true
                )
            ) {

                $db->rollBack();

                mealResponse(
                    "error",
                    "Invalid review status.",
                    400
                );
            }

            $reviewStmt = $db->prepare("
                UPDATE meal_entries
                SET
                    status = :status,
                    reviewed_by = :reviewed_by,
                    reviewed_at = NOW()
                WHERE meal_entry_id = :entry_id
            ");

            $reviewStmt->execute([

                ":status" => $newStatus,

                ":reviewed_by" => $currentUserId,

                ":entry_id" => $entryId

            ]);

            $db->commit();

            mealResponse(
                "success",
                "Meal entry review completed.",
                200,
                [
                    "status" => $newStatus
                ]
            );
        }

        // -------------------------------------
        // Normal Edit Permission
        // -------------------------------------

        $canEdit = $isAdmin || (

            (int) $existing["entered_by"] === $currentUserId &&

            $existing["status"] === "PENDING"

        );

        if (!$canEdit) {

            $db->rollBack();

            mealResponse(
                "error",
                "You cannot edit this meal entry.",
                403
            );
        }

        // Existing or New Values
        $memberId = (int) (
            $input["member_id"] ?? $existing["member_id"]
        );

        $mealDate =
            $input["meal_date"] ?? $existing["meal_date"];

        $mealType = strtoupper(
            (string) (
                $input["meal_type"] ?? $existing["meal_type"]
            )
        );

        $quantity =
            $input["quantity"] ?? $existing["quantity"];

        $guestQuantity =
            $input["guest_quantity"] ?? $existing["guest_quantity"] ?? 0;

        $note = trim(
            (string) (
                $input["note"] ?? $existing["note"] ?? ""
            )
        );

        // Validate Member and Quantity
        if (
            $memberId <= 0 ||
            !in_array(
                $mealType,
                ["LUNCH", "DINNER"],
                true
            ) ||
            !in_array(
                $quantity,
                [0, 0.5, 1, "0", "0.5", "1"],
                true
            )
        ) {

            $db->rollBack();

            mealResponse(
                "error",
                "Invalid meal type, member or quantity.",
                400
            );
        }

        // Validate Guest Quantity
        if (!isValidGuestQuantity($guestQuantity)) {

            $db->rollBack();

            mealResponse(
                "error",
                "Guest quantity must be between 0 and 50 in steps of 0.5.",
                400
            );
        }

        // Validate Date
        $parsedDate = DateTime::createFromFormat(
            "!Y-m-d",
            $mealDate
        );

        if (
            !$parsedDate ||
            $parsedDate->format("Y-m-d") !== $mealDate
        ) {

            $db->rollBack();

            mealResponse(
                "error",
                "Invalid meal date.",
                400
            );
        }

        // Check New Month
        $newMonthCheck = $db->prepare("
            SELECT month_id
            FROM months
            WHERE :meal_date BETWEEN start_date AND end_date
              AND status = 'OPEN'
            LIMIT 1
        ");

        $newMonthCheck->execute([
            ":meal_date" => $mealDate
        ]);

        if (!$newMonthCheck->fetch()) {

            $db->rollBack();

            mealResponse(
                "error",
                "No open accounting month for this date.",
                400
            );
        }

        // Check Member
        $memberCheck = $db->prepare("
            SELECT user_id
            FROM users
            WHERE user_id = :member_id
              AND role = 'MEMBER'
              AND account_status = 'ACTIVE'
            LIMIT 1
        ");

        $memberCheck->execute([
            ":member_id" => $memberId
        ]);

        if (!$memberCheck->fetch()) {

            $db->rollBack();

            mealResponse(
                "error",
                "Selected member is invalid.",
                400
            );
        }

        // Update Meal Entry
        $updateStmt = $db->prepare("
            UPDATE meal_entries
            SET
                member_id = :member_id,
                meal_date = :meal_date,
                meal_type = :meal_type,
                quantity = :quantity,
                guest_quantity = :guest_quantity,
                note = :note
            WHERE meal_entry_id = :entry_id
        ");

        $updateStmt->execute([

            ":member_id" => $memberId,

            ":meal_date" => $mealDate,

            ":meal_type" => $mealType,

            ":quantity" => $quantity,

            ":guest_quantity" => (float) $guestQuantity,

            ":note" => $note !== ""
                ? $note
                : null,

            ":entry_id" => $entryId

        ]);

        $db->commit();

        mealResponse(
            "success",
            "Meal entry updated successfully.",
            200,
            [
                "meal_entry_id" => $entryId
            ]
        );
    }

    // =========================================
    // Unsupported Method
    // =========================================

    mealResponse(
        "error",
        "Method not allowed.",
        405
    );

} catch (PDOException $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    if ($e->getCode() === "23000") {

        mealResponse(
            "error",
            "A meal entry already exists for this member, date and meal type.",
            409
        );
    }

    mealResponse(
        "error",
        "A database error occurred.",
        500
    );

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    mealResponse(
        "error",
        "An unexpected server error occurred.",
        500
    );
}
