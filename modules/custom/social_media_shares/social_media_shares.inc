<?php

/**
 * @file
 * Contains utility functions.
 */

/**
 * Returns an array of Social Media names.
 *
 * @return array
 *   An array of social media names, indexed by machine names.
 *   array(
 *     'facebook' => 'Facebook',
 *     'google_plus' => 'Google Plus',
 *     ...
 *   );
 */

function social_media_shares_get_social_media() {
  $social_media_coll = array('Facebook', 'Linkedin', 'Twitter');
  return _social_media_shares_social_media_make_assoc($social_media_coll);
}

/**
 * Converts an array of social media names into an assocative array.
 */
function _social_media_shares_social_media_make_assoc($array) {
  $output = array();
  foreach ($array as $val) {
    $key = _social_media_shares_make_machine_name($val);
    $output[$key] = $val;
  }
  return $output;
}

/**
 * Generates a machine name from a given string.
 */
function _social_media_shares_make_machine_name($string) {
  return str_replace(' ', '_', strtolower($string));
}
