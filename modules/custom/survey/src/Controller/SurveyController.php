<?php
/**
 * @file
 * Contains \Drupal\survey\Controller\SurveyController
 */

namespace Drupal\survey\Controller;


use \Drupal\node\Entity\Node;
use \Drupal\user\Entity\User; 
use Drupal\Core\Controller\ControllerBase;
use Drupal\survey\Helper\SurveyHelper;
/**
 * Serve to : 
 * 	- Display results for a specific survey for each user
 *  - Display results for a specific user for each survey
 */
class SurveyController extends ControllerBase {
  //Display a list of survey with links to the survey forms
  public function displaySurveys(){
      $surveyHelper = new SurveyHelper();
      $build['#theme'] = 'survey-surveys';
      $build['#surveys'] = $surveyHelper->getAllByContentType('survey');
      return $build;
  }

  //Display a list of surveys and user, both of them contains link to the surveys results
  public function displayResults(){
      $surveyHelper = new SurveyHelper();
      $build['#theme'] = 'survey-results';
      $build['#surveys'] =  $surveyHelper->getAllByContentType('survey');
      //IN SEEK OF IMPROVEMENT, WE CAN LOAD JUST USERS WHO HAS ALREADY SUBMIT A SUBMISSION 
      $build['#users'] = User::loadMultiple();
      return $build;
  }

  //Display a table contains the survey results (where the nid equal $surveyId) 
	public function displayResultsSurvey($surveyId = NULL){
      $surveyHelper = new SurveyHelper();
      $build['#theme'] = 'survey-results-survey';
      $build['#submissions'] = $surveyHelper->getAllSubmissionBySurveyId($surveyId);
      $build['#questions'] = $surveyHelper->getAllQuestionBySurveyId($surveyId);
      return $build;
	}

  //Display a table for each survey submitted by the user (where the uid equal $userId)
	public function displayResultsUser($userId = NULL){
      $surveyHelper = new SurveyHelper();
      $build['#theme'] = 'survey-results-user';
      $build['#user'] = $surveyHelper->getUserName($userId);
      $build['#submissions'] = $surveyHelper->getAllSubmissionByUserId($userId);
      return $build;
	}

  //Display a simple "Thank you" page : The response has been submitted successfully
  public function displayThankYou(){
    $surveyHelper = new SurveyHelper();
    $build['#theme'] = 'survey-thank-you';
    return $build;
  }

  //Display a simple "Sorry" page : The response hasn't submitted
  public function displaySorry(){
    $surveyHelper = new SurveyHelper();
    $build['#theme'] = 'survey-sorry';
    return $build;
  }
}
  