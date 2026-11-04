
<?php

if (session_status() === PHP_SESSION_NONE) {

    session_name("FLATHISAB_SESSION");

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => false, // Localhost development only
        "httponly" => true,
        "samesite" => "Strict"
    ]);

    session_start();
}
