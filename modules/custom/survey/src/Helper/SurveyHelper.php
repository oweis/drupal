<?php
/**
 * @file
 * Contains \Drupal\survey\Helper\SurveyHelper
 */

namespace Drupal\survey\Helper;

use \Drupal\node\Entity\Node;
use \Drupal\user\Entity\User; 


/**
* provide function for SurveyController and hide traitement
*/
class SurveyHelper{
	
	public function SurveyHelper(){

	}

	public function getUserName($userId){
		User::load($userId)->get('name')->value;
	}

	public function getAllByContentType($contentType){
		$nids = \Drupal::entityQuery('node')->condition('type', $contentType)->execute();
		return Node::loadMultiple($nids);
	}

	public function getAllSubmissionBySurveyId($surveyId){
	    $nids = \Drupal::entityQuery('node')
	    	->condition('type', 'submission')
	    	->condition('field_survey', $surveyId)
	    	->execute();
	    $submissions = Node::loadMultiple($nids);
	    
	    //THEN WE WILL GO SUBMISSION AFTER SUBMISSION
	    $i = 0;
	    foreach ($submissions as $submission) {
	      $user = $submission->field_user->referencedEntities();
	      $res[$i]['name'] = $user[0]->get('name')->value; //TO USE : UserName
	      $answers = $submission->field_answer->referencedEntities();
	      $result = 0;
	      $countQuestionWithOptions = 0;
	      foreach ($answers as $answer) {
	      	$problem = $answer->field_problem->referencedEntities();
	      	$type = $problem[0]->field_type->value;
	      	if($type == 'checkboxes') {
	      		$result += intval($answer->field_result);
	      		$total++;
	      	}
	      	foreach ($answer->field_response as $response) {
	      		//NEED TO FIX THIS SO IT CAN HANDLE 0 AS A RESPONSE
	          if($response->value != '0') $var .= $response->value . " ";
			  	       
	        }
	        
	        $res[$i]['responses'][] = $var;
	        unset($var);
	      }
	      $res[$i]['result'] = $result . '/' . $total; 

	      $i++;
	    }
	    return $res;  
	}

    public function getAllQuestionBySurveyId($surveyId = NULL){
  		$survey = Node::load($surveyId);
  		$problems = $survey->field_problem->referencedEntities();
  		$questions = array();
  		foreach ($problems as $problem) {
  			$questions[] = $problem->field_question->value;
  		}
  		return $questions;
  	}	

  	public function getAllSubmissionByUserId($userId = NULL){
  		$nids = \Drupal::entityQuery('node')
	    	->condition('type', 'submission')
	    	->condition('field_user', $userId)
	    	->execute();
	    $submissions = Node::loadMultiple($nids);
  		$i = 0;
  		foreach ($submissions as $submission) {
  			//LOAD THE SURVEY TITLE
  			$survey = $submission->field_survey->referencedEntities();
  			$res[$i]['survey'] = $survey[0]->title->value;
  			$answers = $submission->field_answer->referencedEntities();
  			//LOAD EACH QUESTION FROM PROBLEM
  			foreach ($answers as $answer) {
  				$problem = $answer->field_problem->referencedEntities();
  				$res[$i]['questions'][] = $problem[0]->field_question->value;
  				foreach ($answer->field_response as $response) {
  					if($response->value != '0') 
  						$var .= $response->value . " ";
  				}
  				$res[$i]['responses'][] = $var; 				
  				unset($var);
  			}
  			$res[$i]['result'] = "Not done yet";

  			$i++;
  		}
  		return $res;

  	}

}